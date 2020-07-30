import sys
import os
import re
import hashlib
import jsonpickle
import time
import signal
import logging
from datetime import datetime
from check_args import check_argv, check_folder
from script import Script
from tx import Tx
from mongo import connect_default_db
from queue import Empty
from mongoengine import disconnect_all
from genesis_block import save_genesis_block, GENESIS_BLOCK_HASH
from multiprocessing import Process, Event, Queue
from block import Block, Block_Full, BLOCK_DIFFICULTY_ADJUSTMENT_PERIOD
from network import (
    SimpleNode,
    GetHeadersMessage,
    HeadersMessage,
    GetDataMessage,
    BlockMessage,
    BLOCK_DATA_TYPE
)
from db_helper import (
    fork_starmap_action,
    get_tx_doc,
    get_tx_utxos_in_block,
    get_tx_db,
    get_block_from_db,
    get_db_from_block,
    save_block_to_db,
    get_latest_block_db,
    get_block_doc_block_height,
    get_block_doc_block_hash,
    get_block_doc_tx_hash,
    delete_all_block_db,
    del_block,
    check_tx_reference_db,
    del_tx_reference_bulk,
    del_tx_reference,
    add_tx_reference_to_db
)
from errors import (
    DatabaseQueryFailed,
    ProcessBlockFailed,
    TorNotAvailable,
    ServerSelectionTimeoutError,
    NotUniqueError
)


def start_log(log_level="INFO"):
    path = check_folder(dist_mode)
    logging.basicConfig(
        format='%(asctime)s %(levelname)s:%(message)s',
        filename=os.path.join(path, SYNC_LOG),
        level=getattr(logging, log_level),
        filemode='w',
    )

def log_info(line):
    logging.info(line)

def empty_queue(queue):
    iterations = 0
    while True:
        if not queue.empty():
            queue.get()
        else:
            if iterations < 5:
                iterations += 1
                time.sleep(1)
            else:
                break

def log_process_address_stats(elapsed_time, num_address_process, avg_address_process_time):
    logging.debug("********************************************************************")
    logging.debug("[-] Add Addresses Process - Address processing statistics:")
    logging.debug("[-] Latest addresses process time (secs): {}".format(round(elapsed_time,2)))
    logging.debug("[-] Average addresses process time (secs): {}".format(round(avg_address_process_time,2)))
    logging.debug("[-] Number of address chunks processed by this process: {}".format(num_address_process))
    logging.debug("********************************************************************")

def log_process_block_stats(elapsed_time, num_blocks_process, avg_block_process_time):
    logging.debug("********************************************************************")
    logging.debug("[-] Index Blocks Process - Block processing statistics:")
    logging.debug("[-] Latest block process time (secs): {}".format(round(elapsed_time,2)))
    logging.debug("[-] Average block process time (secs): {}".format(round(avg_block_process_time,2)))
    logging.debug("[-] Number of blocks processed by this process: {}".format(num_blocks_process))
    logging.debug("********************************************************************")

def log_stats():
    latest_block = get_latest_block_db()
    latest_block_hash = latest_block.block_hash
    latest_block_height = latest_block.block_height
    mined_btc = latest_block.mined_btc
    total_size = latest_block.total_size
    logging.info("********************************************************************")
    logging.info("[-] Blockchain statistics:")
    logging.info("[-] Latest block hash: {}".format(latest_block_hash.hex()))
    logging.info("[-] Latest block height: {}".format(str(latest_block_height)))
    logging.info("[-] Blockchain size: {} MB".format(str(int(total_size / 1048576))))
    logging.info("[-] Mined BTC: {} BTC".format(str(mined_btc / 100000000)))
    logging.info("********************************************************************")

def log_block_doc(block_doc):
    logging.debug("********************************************************************")
    logging.debug("     block hash: {}              ".format(block_doc.block_hash.hex()))
    logging.debug("     block height: {}            ".format(block_doc.block_height))
    logging.debug("     block reward: {} BTC        ".format(block_doc.block_reward / 100000000))
    logging.debug("     version: {}                 ".format(block_doc.version))
    logging.debug("     previous block hash: {}     ".format(block_doc.prev_block.hex()))
    logging.debug("     merkle root: {}             ".format(block_doc.merkle_root.hex()))
    logging.debug("     timestamp: {}               ".format(datetime.fromtimestamp(block_doc.timestamp)))
    logging.debug("     difficulty bits: {}         ".format(block_doc.bits.hex()))
    logging.debug("     nonce: {}                   ".format(block_doc.nonce.hex()))
    logging.debug("     tx count: {}                ".format(len(block_doc.txs)))
    logging.debug("     size: {} bytes              ".format(block_doc.size))
    logging.debug("********************************************************************")

def calculate_checksum(obj):
    encoded = jsonpickle.encode(obj).encode("utf-8")
    return hashlib.sha256(encoded).digest()

def get_addresses(block_txs, log_handler=None):
    addresses = []
    for tx in block_txs:
        for i, tx_out in enumerate(tx.tx_outs):
            script_pubkey = tx_out.script_pubkey
            if type(script_pubkey) != Script:
                script_pubkey = Script(script_pubkey.cmds)
            address = ""
            if type(tx) != Tx:
                tx_reference = (tx.tx_hash, i)
            else:
                tx_reference = (tx.hash(), i)
            if script_pubkey.is_p2pk_script_pubkey():
                address = script_pubkey.cmds[0]
            elif script_pubkey.is_p2pkh_script_pubkey():
                address = script_pubkey.cmds[2]
            elif script_pubkey.is_p2sh_script_pubkey():
                address = script_pubkey.cmds[1]
            elif script_pubkey.is_p2wpkh_script_pubkey():
                address = script_pubkey.cmds[1]
            elif script_pubkey.is_p2wsh_script_pubkey():
                address = script_pubkey.cmds[1]
            if address:
                addresses.append((address, tx_reference, log_handler))
            else:
                log_handler(
                "Unsupported Address Type - Tx Reference: {}:{}".format(
                    tx_reference[0].hex(),
                    tx_reference[1]
                    )
                )
    return addresses

def add_tx_references_to_db(block_txs):
    addresses =  get_addresses(block_txs, log_handler=logging.debug)
    logging.info("[-] Adding tx references to database. Qty: {}".format(len(addresses)))
    fork_starmap_action(add_tx_reference_to_db, addresses)
    logging.info("[-] Tx references added to database")
    return True

def get_block_doc(block):

    prev_block_doc = get_block_doc_block_hash(block.prev_block)

    prev_block = get_block_from_db(prev_block_doc)
    prev_block_height = prev_block_doc.block_height
    logging.info("[-] Previous block hash {} (height: {}) in database".format(prev_block_doc.block_hash.hex(), prev_block_doc.block_height))

    block_difficulty_period = (prev_block_height + 1) // BLOCK_DIFFICULTY_ADJUSTMENT_PERIOD
    if (prev_block_height + 1) % BLOCK_DIFFICULTY_ADJUSTMENT_PERIOD == 0:
        first_block_difficulty_period = (block_difficulty_period - 1)
    else:
        first_block_difficulty_period = block_difficulty_period

    first_block_difficulty_period_doc = get_block_doc_block_height(first_block_difficulty_period * BLOCK_DIFFICULTY_ADJUSTMENT_PERIOD)
    first_block_difficulty_period = get_block_from_db(first_block_difficulty_period_doc)

    assert block.validate(prev_block, prev_block_height, first_block_difficulty_period, logger_handler=logging.debug), "[!] Block failed validation!"
    logging.info("[-] Block {} validated".format(block.hash().hex()))
    block_height = prev_block_height + 1
    expected_block_reward = block.expected_block_reward(block_height)
    expected_mined_btc = prev_block_doc.mined_btc + expected_block_reward
    total_size = prev_block_doc.total_size + block.size()
    txs = []
    for i, tx in enumerate(block.txs):
        if i == 0:
            txs.append(get_tx_doc(tx, coinbase=True))
        else:
            txs.append(get_tx_doc(tx, tx_utxos_in_block=get_tx_utxos_in_block(block.txs)))
    return get_db_from_block(block, block_height, expected_block_reward, txs, expected_mined_btc, total_size)

def resolve_blocks_from_height(start_block_height):
    logging.info("[-] Resolving block duplicates greater than or equal to block height {}".format(start_block_height))
    latest_block = get_latest_block_db()
    tx_reference_docs = check_tx_reference_db()
    latest_block_height = latest_block.block_height
    for h in range(latest_block_height, start_block_height - 1, -1):
        try:
            block_match = get_block_doc_block_height(h)
            logging.info("[-] Working on block height: {}".format(block_match.block_height))
            addresses = get_addresses(block_match.txs, log_handler=logging.info)
            fork_starmap_action(del_tx_reference, addresses)
            del_block(block_match.block_hash, logging.info)
        except DatabaseQueryFailed:
            pass

def add_block_to_db(block_doc):

    def parse_err(e):
        match = re.search(r'{ (block_hash|txs.tx_hash): BinData\(0, [0123456789ABCDEF]{64}\) }', str(e))
        duplicate = match.group(0).strip("{ ").strip(" }").split(": ")
        duplicate_type = duplicate[0]
        duplicate_hash = bytes.fromhex(duplicate[1].split(", ")[1].split(")")[0])
        return duplicate_type, duplicate_hash

    def is_coinbase(tx):
        return len(tx.tx_ins) == 1 and tx.tx_ins[0].prev_tx == b"\x00" * 32 and tx.tx_ins[0].prev_index == 0xffffffff

    def add_block(block_doc):
        logging.info("[-] Adding Block to database")
        save_block_to_db(block_doc)
        logging.info("[-] Block added to database")
        log_stats()
        return True

    def resolve(duplicate_type, duplicate_hash, block_doc):
        if duplicate_type == "txs.tx_hash":
            logging.info("[-] Resolving transaction duplicate")
            block = get_block_doc_tx_hash(duplicate_hash)
            coinbase_tx_doc = block_doc.txs[0]
            existing_tx = get_tx_db(duplicate_hash)
            existing_tx_is_coinbase = is_coinbase(existing_tx)
            same_tx_hash = existing_tx.tx_hash == bytes(coinbase_tx_doc.tx_hash)
            if block.block_hash != block_doc.block_hash and block_doc.block_height > block.block_height and existing_tx_is_coinbase and same_tx_hash:
                logging.info("[-] The same coinbase tx appears to be used in a previous block height: {}".format(block.block_height))
                coinbase_tx_doc.tx_hash = block_doc.block_height.to_bytes(3, "big") + coinbase_tx_doc.tx_hash
                block_doc.txs[0] = coinbase_tx_doc
                logging.info("[-] Appended block height to the tx hash. Total bytes: {}".format(len(coinbase_tx_doc.tx_hash)))
            else:
                logging.info("[-] Appears to be a tx without a corresponding block in the database")
                logging.info("[-] Attempting to delete Tx with hash: {} from database".format(existing_tx.tx_hash.hex()))
                existing_tx._instance.delete()
                logging.info("[-] Tx deleted")
        else:
            block_doc_duplicate = get_block_doc_block_hash(duplicate_hash)
            block_doc.id = block_doc_duplicate.id
            block_doc_duplicate_checksum = calculate_checksum(block_doc_duplicate.to_json())
            block_doc_checksum = calculate_checksum(block_doc.to_json())
            logging.info("[-] Block document checksum: {}".format(block_doc_checksum.hex()))
            if block_doc_checksum == block_doc_duplicate_checksum:
                logging.info("[-] Block duplicate checksum matches: {}".format(block_doc_duplicate_checksum.hex()))
                logging.info("[-] Keeping block duplicate in database")
                return True
            else:
                logging.info("[-] Block duplicate checksum does not match!: {}".format(block_doc_duplicate_checksum.hex()))
                addresses = get_addresses(block_doc_duplicate.txs, log_handler=logging.info)
                del_tx_reference_bulk(addresses)
                del_block(duplicate_hash, log_handler=logging.info)
        return add_block_to_db(block_doc)

    try:
        return add_block(block_doc)
    except NotUniqueError as e:
        duplicate_type, duplicate_hash = parse_err(e)
        logging.warning("[!] Duplicate Warning: {}:{}".format(duplicate_type, duplicate_hash.hex()))
        logging.warning("[!] Error adding block to database")
        return resolve(duplicate_type, duplicate_hash, block_doc)

def process_block(working_block):
    try:
        logging.info("[-] Validating block hash: {}".format(working_block.hash().hex()))
        block_doc = get_block_doc(working_block)
        return working_block.txs, block_doc
    except AssertionError as assertion_error:
        raise ProcessBlockFailed(assertion_error)
    except DatabaseQueryFailed as database_query_error:
        raise DatabaseQueryFailed(database_query_error)

def get_block_group(run_event, node, block_id_hashes, exceptions):
    blocks = []
    if node is None:
        node = connect_bitcoin(host, port, tor=tor)
    for h in block_id_hashes:
        if run_event.is_set():
            blocks.append(get_block(h, btc_client=node))
    if node and not node.tor:
        disconnect_btc_client(node)
    return blocks

def get_segment_block_id_hashes(run_event, btc_client, block_hashes_queue, start_block):
    if run_event.is_set():
        get_headers_msg = GetHeadersMessage(start_block=start_block)
        btc_client.send(get_headers_msg)
        headers = btc_client.wait_for(HeadersMessage).blocks
        if len(headers) > 0:
            logging.info("[-] Downloaded {} block headers after block hash: {}".format(len(headers), start_block.hex()))
            block_id_hashes = []
            group_start_block = start_block
            for i, header in enumerate(headers):
                if i % 5 == 0 and i > 0:
                    while run_event.is_set():
                        if not block_hashes_queue.full():
                            block_hashes_queue.put(block_id_hashes)
                            break
                    if i == len(headers) - 1:
                        break
                    group_start_block = block_id_hashes[-1]
                    block_id_hashes = []
                    block_id_hashes.append(header.hash())
                elif i == len(headers) - 1:
                    block_id_hashes.append(header.hash())
                    while run_event.is_set():
                        if not block_hashes_queue.full():
                            block_hashes_queue.put(block_id_hashes)
                            break
                else:
                    block_id_hashes.append(header.hash())
            return headers[-1].hash()
    return None

def download_all_blocks(
    run_event,
    block_hashes_queue,
    blocks_downloaded_queue,
    exceptions
):
    run_event.set()
    if tor:
        logging.info("[-] Initiating tor used by process: download_all_blocks")
        node = connect_bitcoin(host, port, tor, process_name="download_all_blocks")
    else:
        node = None
    while run_event.is_set():
        try:
            block_id_hashes = block_hashes_queue.get()
            logging.info(
                "[-] Download {} blocks starting from hash: {}".format(
                    len(block_id_hashes),
                    block_id_hashes[0].hex()
                )
            )
            block_group = get_block_group(
                run_event,
                node,
                block_id_hashes,
                exceptions
            )
            while run_event.is_set():
                if not blocks_downloaded_queue.full() and block_group:
                    for block in block_group:
                        blocks_downloaded_queue.put(block)
                    logging.info("[-] {} blocks added to downloaded queue".format(len(block_group)))
                    break
        except Empty:
                pass
        except (RuntimeError, BrokenPipeError, OSError) as err:
            if node and node.tor:
                logging.info("[-] Killing tor used by process: download_all_blocks")
                disconnect_btc_client(node)
            exceptions.put(err)
            empty_queue(blocks_downloaded_queue)
            break
    if node and node.tor:
        logging.info("[-] Killing tor used by process: download_all_blocks")
        disconnect_btc_client(node)
    empty_queue(blocks_downloaded_queue)

def process_blocks(
    run_event,
    block_process_event,
    blocks_downloaded_queue,
    add_addresses_queue,
    jobs_queue,
    completed_jobs_process_blocks,
    exceptions
):

    run_event.set()
    block_process_event.set()
    avg_block_process_time = None
    num_blocks_process = 0
    while run_event.is_set():
        try:
            block_process_event.clear()
            block = blocks_downloaded_queue.get(block=False)
            logging.info("[-] Working on block hash: {}".format(block.hash().hex()))
            start_time = time.time()
            jobs_queue.put((
                "process_blocks",
                process_block,
                block,
                False
            ))
            while run_event.is_set():
                try:
                    txs, block_doc = completed_jobs_process_blocks.get(block=False)
                    break
                except Empty:
                    pass
            if run_event.is_set():
                log_block_doc(block_doc)
                add_addresses_queue.put((txs, block_doc))
                num_blocks_process += 1
                elapsed_time = time.time() - start_time
                if avg_block_process_time is None:
                    avg_block_process_time = elapsed_time
                else:
                    avg_block_process_time = ((avg_block_process_time * (num_blocks_process - 1)) + elapsed_time) / num_blocks_process
                log_process_block_stats(
                    elapsed_time,
                    num_blocks_process,
                    avg_block_process_time
                )
                block_process_event.wait()
        except Empty:
            pass
        except (DatabaseQueryFailed, ProcessBlockFailed) as err:
            exceptions.put(err)
            empty_queue(add_addresses_queue)
            empty_queue(completed_jobs_process_blocks)
            break
    empty_queue(add_addresses_queue)
    empty_queue(completed_jobs_process_blocks)

def add_addresses(
    run_event,
    add_addresses_queue,
    add_blocks_queue,
    jobs_queue,
    completed_jobs_add_addresses,
    exceptions
):

    run_event.set()
    avg_address_process_time = None
    num_address_process = 0
    while run_event.is_set():
        try:
            txs, block_doc = add_addresses_queue.get(block=False)
            start_time = time.time()
            jobs_queue.put((
                "add_addresses",
                add_tx_references_to_db,
                txs,
                False
            ))
            while run_event.is_set():
                try:
                    completed_jobs_add_addresses.get(block=False)
                    break
                except Empty:
                    pass
            if run_event.is_set():
                add_blocks_queue.put(block_doc)
                num_address_process += 1
                elapsed_time = time.time() - start_time
                if avg_address_process_time is None:
                    avg_address_process_time = elapsed_time
                else:
                    avg_address_process_time = ((avg_address_process_time * (num_address_process - 1)) + elapsed_time) / num_address_process
                log_process_address_stats(
                    elapsed_time,
                    num_address_process,
                    avg_address_process_time
                )
        except Empty:
            pass
        except (DatabaseQueryFailed, ProcessBlockFailed) as err:
            exceptions.put(err)
            empty_queue(add_blocks_queue)
            break
    empty_queue(add_blocks_queue)

def add_blocks(
    run_event,
    block_process_event,
    add_blocks_queue,
    jobs_queue,
    completed_jobs_add_blocks,
    exceptions
):

    run_event.set()
    while run_event.is_set():
        try:
            block_doc = add_blocks_queue.get(block=False)
            jobs_queue.put((
                "add_blocks",
                add_block_to_db,
                block_doc,
                False
            ))
            while run_event.is_set():
                try:
                    completed_jobs_add_blocks.get(block=False)
                    block_process_event.set()
                    break
                except Empty:
                    pass
            print(
                "Added block {}/ {} [{} bytes]".format(
                    block_doc.block_hash.hex(),
                    block_doc.block_height,
                    block_doc.size
                )
            )
            sys.stdout.flush()
        except Empty:
            pass
        except DatabaseQueryFailed as err:
            exceptions.put(err)
            break
    if not block_process_event.is_set():
        block_process_event.set()
    block_process_event.clear()

def get_all_block_id_hashes(run_event, block_hashes_queue, start_block, exceptions):

    run_event.set()
    node = None
    try:
        if tor:
            logging.info("[-] Initiating tor used by process: get_all_block_id_hashes")
        node = connect_bitcoin(host, port, tor=tor, process_name="get_all_block_id_hashes")
        while start_block is not None and run_event.is_set():
            start_block = get_segment_block_id_hashes(
                run_event,
                node,
                block_hashes_queue,
                start_block
            )
        if node.tor:
            logging.info("[-] Killing tor used by process: get_all_block_id_hashes")
        disconnect_btc_client(node)
        if not run_event.is_set():
            empty_queue(block_hashes_queue)
    except (RuntimeError, BrokenPipeError, OSError, AttributeError) as err:
        disconnect_btc_client(node)
        exceptions.put(err)
        empty_queue(block_hashes_queue)


def initiate_block_hashes_download_process(
    start_block,
    block_hashes_queue,
    exceptions
):
    block_hash_download_event = Event()
    block_hash_download_event.name = "block_hash_download"
    events.append(block_hash_download_event)
    block_hash_download_process = Process(
        name="get_all_block_id_hashes",
        target=get_all_block_id_hashes,
        args=(
            block_hash_download_event,
            block_hashes_queue,
            start_block,
            exceptions
        )
    )
    processes.append(block_hash_download_process)
    logging.info("[-] Initiating process: Block hashes download")
    block_hash_download_process.start()

def initiate_process_blocks_process(
    block_process_event,
    blocks_downloaded_queue,
    add_addresses_queue,
    jobs_queue,
    completed_jobs_process_blocks,
    exceptions
):
    process_blocks_event = Event()
    process_blocks_event.name = "process_blocks"
    events.append(process_blocks_event)
    process_blocks_process = Process(
        name="process_blocks",
        target=process_blocks,
        args=(
            process_blocks_event,
            block_process_event,
            blocks_downloaded_queue,
            add_addresses_queue,
            jobs_queue,
            completed_jobs_process_blocks,
            exceptions
        )
    )
    processes.append(process_blocks_process)
    logging.info("[-] Initiating process: Process downloaded blocks")
    process_blocks_process.start()

def initiate_add_addresses_process(
    add_addresses_queue,
    add_blocks_queue,
    jobs_queue,
    completed_jobs_add_addresses,
    exceptions
):
    add_addresses_event = Event()
    add_addresses_event.name = "add_addresses_event"
    events.append(add_addresses_event)
    add_addresses_process = Process(
        name="add_addresses",
        target=add_addresses,
        args=(
            add_addresses_event,
            add_addresses_queue,
            add_blocks_queue,
            jobs_queue,
            completed_jobs_add_addresses,
            exceptions
        )
    )
    processes.append(add_addresses_process)
    logging.info("[-] Initiating process: Add addresses")
    add_addresses_process.start()

def initiate_add_blocks_process(
    block_process_event,
    add_blocks_queue,
    jobs_queue,
    completed_jobs_add_blocks,
    exceptions
):
    add_blocks_event = Event()
    add_blocks_event.name = "add_blocks_event"
    events.append(add_blocks_event)
    add_blocks_process = Process(
        name="add_blocks",
        target=add_blocks,
        args=(
            add_blocks_event,
            block_process_event,
            add_blocks_queue,
            jobs_queue,
            completed_jobs_add_blocks,
            exceptions
        )
    )
    processes.append(add_blocks_process)
    logging.info("[-] Initiating process: Add blocks")
    add_blocks_process.start()

def initiate_block_download_all_process(
    block_hashes_queue,
    blocks_downloaded_queue,
    exceptions
):
    block_download_all_event = Event()
    block_download_all_event.name = "block_download_all"
    events.append(block_download_all_event)
    block_download_all_process = Process(
        name="download_all_blocks",
        target=download_all_blocks,
        args=(
            block_download_all_event,
            block_hashes_queue,
            blocks_downloaded_queue,
            exceptions
        )
    )
    processes.append(block_download_all_process)
    logging.info("[-] Initiating process: Block download all")
    block_download_all_process.start()

def initiate_processes(start_block, sync_event):
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    path = check_folder(dist_mode)
    with open(os.path.join(path, SYNC_FILE), "w") as f:
        try:
            logging.info("[-] Syncing")
            f.write("TRUE")
        except:
            logging.critical("[!] Unable to write .sync file.")

    exceptions = Queue()
    block_hashes_queue = Queue(maxsize=400)
    blocks_downloaded_queue = Queue(maxsize=25)
    blocks_process_queue = Queue()
    add_addresses_queue = Queue()
    add_blocks_queue = Queue()
    jobs_queue = Queue()
    completed_jobs_process_blocks = Queue()
    completed_jobs_add_addresses = Queue()
    completed_jobs_add_blocks = Queue()

    completed_jobs_queue_map = {
        "process_blocks": completed_jobs_process_blocks,
        "add_addresses": completed_jobs_add_addresses,
        "add_blocks": completed_jobs_add_blocks
    }

    block_process_event = Event()

    if sync_event.is_set():
        initiate_block_hashes_download_process(
            start_block,
            block_hashes_queue,
            exceptions
        )

    if sync_event.is_set():
        initiate_block_download_all_process(
            block_hashes_queue,
            blocks_downloaded_queue,
            exceptions
        )

    if sync_event.is_set():
        initiate_process_blocks_process(
            block_process_event,
            blocks_downloaded_queue,
            add_addresses_queue,
            jobs_queue,
            completed_jobs_process_blocks,
            exceptions
        )

    if sync_event.is_set():
        initiate_add_addresses_process(
            add_addresses_queue,
            add_blocks_queue,
            jobs_queue,
            completed_jobs_add_addresses,
            exceptions
        )

    if sync_event.is_set():
        initiate_add_blocks_process(
            block_process_event,
            add_blocks_queue,
            jobs_queue,
            completed_jobs_add_blocks,
            exceptions
        )

    signal.signal(signal.SIGINT, default_handler)

    while sync_event.is_set():
        try:
            start_time = time.time()
            try:
                exception = exceptions.get(block=False)
                print("Exception occurred: ", exception)
                raise exception
            except Empty:
                pass
            finally:
                try:
                    process, action, args, unpack = jobs_queue.get(block=False)
                    if unpack:
                        result = action(*args)
                    else:
                        result = action(args)
                    if result:
                        completed_jobs_queue_map[process].put(result)
                except Empty:
                    pass
                finally:
                    if all([
                        block_hashes_queue.empty(),
                        blocks_downloaded_queue.empty(),
                        blocks_process_queue.empty(),
                        time.time() - start_time > 10000
                    ]):
                        log_stats()
                        with open(SYNC_FILE, "w") as f:
                            try:
                                logging.info("[-] Sync complete")
                                f.write("FALSE")
                            except:
                                logging.critical("[!] Unable to write .sync file.")
                        time.sleep(180)
                        break
        except KeyboardInterrupt:
            empty_queue(jobs_queue)
            raise

def get_block(block_hash, btc_client=None):
    try:
        if btc_client is not None:
            node = btc_client
        else:
            if tor:
                logging.info("[-] Initiating tor used by main process function: get block")
            node = connect_bitcoin(host, port, tor=tor)
        get_data_msg = GetDataMessage()
        get_data_msg.add_data(BLOCK_DATA_TYPE, block_hash)
        node.send(get_data_msg)
        block_msg = node.wait_for(BlockMessage)
        logging.info("[-] Block download completed: hash {}".format(block_hash.hex()))
        if btc_client is None:
            if node.tor:
                logging.info("[-] Killing tor used by main process function: get block")
            disconnect_btc_client(node)
        return Block_Full(
            block_msg.version,
            block_msg.prev_block,
            block_msg.merkle_root,
            block_msg.timestamp,
            block_msg.bits,
            block_msg.nonce,
            block_msg.txs
        )
    except RuntimeError as err:
        raise RuntimeError("[-] Block {} download has failed".format(block_hash.hex()))

def find_latest_acceptable_block(block_height):
    block_doc = get_block_doc_block_height(block_height)
    if block_doc:
        block = get_block(block_doc.block_hash)
        if block:
            return block.hash(), block_height
    return find_latest_acceptable_block(block_height - 1)

def main(sync_event):
    while not sync_event.is_set():
        sync_event.set()
        latest_block = get_latest_block_db()
        tx_reference_docs = check_tx_reference_db()
        if latest_block is None:
            delete_all_block_db()
            save_genesis_block()
            latest_block_hash = GENESIS_BLOCK_HASH
            latest_block_height = 0
        else:
            latest_block_hash = latest_block.block_hash
            latest_block_height = latest_block.block_height
            logging.info("[-] Finding latest acceptable block in the chain")
            latest_block_hash, latest_block_height = find_latest_acceptable_block(latest_block_height)
        log_stats()
        logging.info("[-] Blockchain sync will start after height: {} and hash: {}".format(latest_block_height, latest_block_hash.hex()))
        time.sleep(5)
        initiate_processes(latest_block_hash, sync_event)

def connect_bitcoin(host, port, tor=False, logging=False, process_name="main"):
    if tor:
        if logging:
            logging.info("[-] Tor connection is requested")
            logging.info("[-] Connecting to bitcoin node {}:{}".format(host, port))
        node = SimpleNode(host, port, logging=log_info, tor=tor, process_name=process_name)
        if node.tor:
            if logging:
                logging.info("[-] SOCKS5 proxy listener on TCP:{}".format(node.socks_port))
            node.handshake()
    else:
        if logging:
            logging.info("[-] Connecting to bitcoin node {}:{}".format(host, port))
        node = SimpleNode(host, port, logging=log_info, tor=tor)
        node.handshake()
    return node

def disconnect_btc_client(btc_client):
    try:
        if btc_client.tor:
            btc_client.tor.kill()
            logging.info("[-] Killed tor process")
        logging.info("[-] Disconnecting bitcoin node socket")
        btc_client.socket.close()
    except:
        pass

def disconnect_db_clients():
    logging.info("[-] Disconnecting database clients")
    for client in db_clients:
        client.close()
    disconnect_all()

def remove_sync_file():
    path = check_folder(dist_mode)
    if os.path.exists(os.path.join(path, SYNC_FILE)):
        os.remove(os.path.join(path, SYNC_FILE))

def stop_events():
    logging.info("[-] Clearing events")
    print("********************************************************************")
    logging.info("Total events to stop: {}".format(len(events[1:])))
    print("Total events to stop: {}".format(len(events[1:])))
    for event in events[1:]:
        logging.info("Ending Event: {}".format(event.name))
        print("Ending Event: {}".format(event.name))
        if not event.is_set():
            event.set()
        event.clear()
        index = events.index(event)
        events.pop(index)
    logging.info("[-] Events ended")
    print("Events ended\n")
    print("********************************************************************")
    sys.stdout.flush()

def stop_processes():
    logging.info("[-] Clearing processes")
    print("********************************************************************")
    logging.info("Total processes to terminate: {}".format(len(processes)))
    print("Total processes to terminate: {}".format(len(processes)))
    while len(processes) > 0:
        for process in processes:
            checked = False
            killed = False
            logging.info("[-] Ending Process (pid: {}): {}".format(process.pid, process.name))
            print("Ending Process (pid: {}): {}".format(process.pid, process.name))
            while process.is_alive():
                if not checked:
                    process.join(1)
                    checked = True
                else:
                    if not killed:
                        logging.info("[-] Terminating Process (pid: {}): {}".format(process.pid, process.name))
                        print("Terminating Process (pid: {}): {}".format(process.pid, process.name))
                        process.terminate()
                        process.join(1)
                        killed = True
                    else:
                        logging.info("[-] Forcefully Killing Process (pid: {}): {}".format(process.pid, process.name))
                        print("Forcefully Killing Process (pid: {}): {}".format(process.pid, process.name))
                        os.kill(process.pid, signal.SIGKILL)
                        process.join(1)
            index = processes.index(process)
            processes.pop(index)
    logging.info("[-] Processes ended")
    print("Processes ended\n")
    print("********************************************************************")
    sys.stdout.flush()

def restart():
    remove_sync_file()
    stop_events()
    stop_processes()
    disconnect_db_clients()

def quit(start_time):
    remove_sync_file()
    stop_events()
    stop_processes()
    disconnect_db_clients()
    events[0].clear()
    logging.info("[-] Running time (mins): {}".format(round((time.time() - start_time) / 60, 2)))
    print("Running time (mins): {}".format(round((time.time() - start_time) / 60, 2)))
    logging.shutdown()
    sys.stdout.flush()

def start(host, port, tor=False):
    start_time = time.time()
    main_event = Event()
    main_event.name = "main"
    events.append(main_event)
    main_event.set()
    while main_event.is_set():
        try:
            sync_event = Event()
            sync_event.name = "sync"
            events.append(sync_event)
            db_default_client = connect_default_db()
            db_clients.append(db_default_client)
            if tor:
                logging.info("[-] Tor connection is requested")
                logging.info("[-] SOCKS5 proxy listener will be used")
            logging.info("[-] Network connection to bitcoin node {}:{}".format(host, port))
            if DELETE_FROM_BLOCK_HEIGHT:
                resolve_blocks_from_height(DELETE_FROM_BLOCK_HEIGHT)
                quit(start_time)
            else:
                main(sync_event)
        except ServerSelectionTimeoutError:
            logging.critical("[!] Unable to connect to database")
            restart()
            logging.warning("[!] Database connection: re-attempting in 30 seconds")
            try:
                time.sleep(30)
            except KeyboardInterrupt:
                logging.info("[-] CTRL-C detected. Exiting gracefully")
                print("Exiting. Please wait for clean up process to complete")
                quit(start_time)
        except TorNotAvailable:
            logging.critical("[!] Tor is not available")
            restart()
            logging.warning("[!] Tor connection: re-attempting in 30 seconds")
            try:
                time.sleep(30)
            except KeyboardInterrupt:
                logging.info("[-] CTRL-C detected. Exiting gracefully")
                print("Exiting. Please wait for clean up process to complete")
                quit(start_time)
        except (ProcessBlockFailed, DatabaseQueryFailed) as process_block_error:
            logging.critical("[!] {}".format(process_block_error))
            logging.critical("[!] Invalid block")
            restart()
            logging.critical("[!] Halting sync for 60 seconds")
            try:
                time.sleep(60)
            except KeyboardInterrupt:
                logging.info("[-] CTRL-C detected. Exiting gracefully")
                print("Exiting. Please wait for clean up process to complete")
                quit(start_time)
        except (RuntimeError, BrokenPipeError, OSError, Exception) as network_error:
            logging.warning("[!] {}".format(network_error))
            logging.critical("[!] Unable to connect to bitcoin node")
            restart()
            logging.warning("[!] Bitcoin node connection: re-attempting in 30 seconds")
            try:
                time.sleep(30)
            except KeyboardInterrupt:
                logging.info("[-] CTRL-C detected. Exiting gracefully")
                print("Exiting. Please wait for clean up process to complete")
                quit(start_time)
        except KeyboardInterrupt:
            logging.info("[-] CTRL-C detected. Exiting gracefully")
            print("Exiting. Please wait for clean up process to complete")
            quit(start_time)

if __name__ == "__main__":
    DELETE_FROM_BLOCK_HEIGHT = None
    SYNC_FILE = ".sync"
    SYNC_LOG = "sync.log"
    events = []
    processes = []
    db_clients = []
    host, port, log_level, tor, dist_mode = check_argv()
    default_handler = signal.getsignal(signal.SIGINT)
    logger = start_log(log_level)
    logging.info("********************************************************************")
    start(host, port, tor)
