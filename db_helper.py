import signal
import uuid
from block import Block
from mongo import Script as Script_db
from mongo import Witness as Witness_db
from mongo import TxIn as TxIn_db
from mongo import TxInCoinbase as TxInCoinbase_db
from mongo import TxOut as TxOut_db
from mongo import Tx as Tx_db
from mongo import Block as Block_db
from mongo import TxReference as TxReference_db
from mongo import connect_db
from mongoengine import disconnect
from mongoengine.context_managers import switch_db
from errors import DatabaseQueryFailed, CursorNotFound, NotUniqueError
from multiprocessing import Pool
from contextlib import contextmanager

def chunk_list(data_set, chunksize=10):
    new_list = []
    for i, elem in enumerate(data_set):
        if i % chunksize == 0:
            if i > 0:
                new_list.append(chunk)
            chunk = []
            chunk.append(elem)
            if i == len(data_set) - 1:
                new_list.append(chunk)
                break
        elif i == len(data_set) - 1:
            chunk.append(elem)
            new_list.append(chunk)
            break
        else:
            chunk.append(elem)
    return new_list

@contextmanager
def Mongo_Wrapper(alias=None):
    try:
        if alias is None:
            alias = str(uuid.uuid4())
        db_alias_client = connect_db(alias)
        yield alias, db_alias_client
    finally:
        disconnect(alias)

def save_block_to_db(doc):
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(Block_db, alias) as Block_db_switch:
            Block_db_switch(
                block_hash=doc.block_hash,
                block_height=doc.block_height,
                block_reward=doc.block_reward,
                version=doc.version,
                prev_block=doc.prev_block,
                merkle_root=doc.merkle_root,
                timestamp=doc.timestamp,
                bits=doc.bits,
                nonce=doc.nonce,
                txs=doc.txs,
                size=doc.size,
                mined_btc=doc.mined_btc,
                total_size=doc.total_size
            ).save()


def fork_map_action(action, data_set, processes=None, chunk_size=10):
    def worker_init():
        signal.signal(signal.SIGINT, signal.SIG_IGN)

    with Pool(processes=processes, initializer=worker_init) as pool:
        result = pool.map(action, data_set, chunk_size)
    return result


def fork_starmap_action(action, data_set, processes=None, chunk_size=10):
    def worker_init():
        signal.signal(signal.SIGINT, signal.SIG_IGN)

    with Pool(processes=processes, initializer=worker_init) as pool:
        result = pool.starmap(action, data_set, chunk_size)
    return result

def del_tx_reference_bulk(bundle):
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(TxReference_db, alias) as TxReference_db_switch:
            for b in bundle:
                address, tx_reference, log_handler = b
                tx_hash = bytes(tx_reference[0])
                tx_index = tx_reference[1]

                if log_handler is not None:
                    log_handler("[-] Attempting to delete tx reference: {}:{}".format(tx_hash.hex(), tx_index))

                try:
                    tx_reference_docs = TxReference_db_switch.objects(tx_hash=tx_hash, tx_index=tx_index)
                except (CursorNotFound):
                    disconnect(alias)
                    raise DatabaseQueryFailed("Database query failed for tx reference {}:{} with address: {}".format(tx_hash.hex(), tx_index, address.hex()))

                if len(tx_reference_docs) == 1:
                    tx_reference_doc = tx_reference_docs[0]
                    if log_handler is not None:
                        log_handler("[-] Tx reference {}:{} is already added to database".format(tx_hash.hex(), tx_index))
                    tx_reference_doc.delete()
                    if log_handler is not None:
                        log_handler("[-] Tx reference {}:{} deleted".format(tx_hash.hex(), tx_index))
                else:
                    if log_handler is not None:
                        log_handler("[-] Tx reference {}:{} is not in database".format(tx_hash.hex(), tx_index))

def del_tx_reference(address, tx_reference, log_handler=None):
    tx_hash = bytes(tx_reference[0])
    tx_index = tx_reference[1]
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(TxReference_db, alias) as TxReference_db_switch:
            if log_handler is not None:
                log_handler("[-] Attempting to delete tx reference: {}:{}".format(tx_hash.hex(), tx_index))

            try:
                tx_reference_docs = TxReference_db_switch.objects(tx_hash=tx_hash, tx_index=tx_index)
            except (CursorNotFound):
                disconnect(alias)
                raise DatabaseQueryFailed("Database query failed for tx reference {}:{} with address: {}".format(tx_hash.hex(), tx_index, address.hex()))

            if len(tx_reference_docs) == 1:
                tx_reference_doc = tx_reference_docs[0]
                if log_handler is not None:
                    log_handler("[-] Tx reference {}:{} is already added to database".format(tx_hash.hex(), tx_index))
                tx_reference_doc.delete()
                if log_handler is not None:
                    log_handler("[-] Tx reference {}:{} deleted".format(tx_hash.hex(), tx_index))
            else:
                if log_handler is not None:
                    log_handler("[-] Tx reference {}:{} is not in database".format(tx_hash.hex(), tx_index))

def get_tx_reference(tx_hash, tx_index):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(TxReference_db, alias) as TxReference_db_switch:
                tx_reference_doc = TxReference_db_switch.objects(tx_hash=tx_hash, tx_index=tx_index)
                return tx_reference_doc
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for tx reference: {}:{}".format(tx_hash.hex(), tx_index))

def get_tx_reference_address_db(address):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(TxReference_db, alias) as TxReference_db_switch:
                tx_reference_docs = TxReference_db_switch.objects(address=address)
                if len(tx_reference_docs) > 0:
                    return tx_reference_docs
                else:
                    raise DatabaseQueryFailed("Not found! Database query for address: {}".format(address.hex()))
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for address: {}".format(address.hex()))

def check_tx_reference_db():
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(TxReference_db, alias) as TxReference_db_switch:
                tx_reference_docs = TxReference_db_switch.objects()
                return tx_reference_docs
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for address: {}".format(address.hex()))

def add_tx_reference_to_db(address, tx_reference, log_handler=None):
    tx_hash = tx_reference[0]
    tx_index = tx_reference[1]
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(TxReference_db, alias) as TxReference_db_switch:
            try:
                tx_reference_doc = TxReference_db_switch(
                    tx_hash=tx_hash,
                    tx_index=tx_index,
                    address=address,
                )
                tx_reference_doc.save()
                if log_handler is not None:
                    log_handler("[-] New tx reference added to database for address: {}".format(address.hex()))
                    log_handler("[-] Added tx reference: {}:{}".format(tx_hash.hex(), tx_index))
            except NotUniqueError as e:
                if log_handler is not None:
                    log_handler("[!] Duplicate Warning for tx reference: {}:{}".format(tx_hash.hex(), tx_index))
                    log_handler("[!] Tx reference is already added to database")

def delete_all_block_db():
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                Block_db_switch.objects().all().delete()
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for delete all blocks")

def get_block_doc_tx_hash(tx_hash):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                block_doc = Block_db_switch.objects(txs__tx_hash=tx_hash)[0]
                return block_doc
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for block at tx hash: {}".format(tx_hash.hex()))

def get_block_doc_tx_in_hash_prev_index(tx_hash, tx_index):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                #block_doc = Block_db_switch.objects(txs__tx_ins__match={"prev_tx": tx_hash, "prev_index": tx_index})
                block_doc = Block_db.objects(Q(txs__tx_hash__ne=tx_hash) & Q(txs__tx_ins__match={"prev_tx": tx_hash, "prev_index": tx_index}))
                return block_doc
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for block at tx hash: {}".format(tx_hash.hex()))

def get_block_doc_from_block_height(block_height):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                block_docs = Block_db_switch.objects(block_height__gte=block_height)
                return block_docs
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for from block height: {}".format(block_height))

def get_block_doc_block_hash(block_hash):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                block_doc = Block_db_switch.objects(block_hash=block_hash)[0]
                return block_doc
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for block hash: {}".format(block_hash.hex()))

def get_block_doc_block_height(block_height):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                block_doc = Block_db_switch.objects(block_height=block_height)[0]
                return block_doc
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for block height: {}".format(block_height))

def get_latest_block_db():
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                block = Block_db_switch.objects.order_by("-block_height").first()
                return block
    except (CursorNotFound):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for get latest block")

def get_latest_blocks_db():
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                blocks = Block_db_switch.objects.order_by("-block_height")[:10]
                return blocks
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for get latest blocks")

def del_block_bulk(bundle):
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(Block_db, alias) as Block_db_switch:
            for b in bundle:
                block_hash, log_handler = b
                try:
                    blocks_to_delete = Block_db_switch.objects(block_hash=block_hash)
                except (CursorNotFound):
                    disconnect(alias)
                    raise DatabaseQueryFailed("Database query failed for get block hashes")

                if log_handler is not None:
                    log_handler("[-] Attempting to delete block with hash: {} from database".format(block_hash.hex()))
                if len(blocks_to_delete) == 1:
                    if log_handler is not None:
                        log_handler("[-] Block is already added to database. Deleting")
                    block_to_delete = blocks_to_delete[0]
                    block_to_delete.delete()
                    if log_handler is not None:
                        log_handler("[-] Block deleted")
                else:
                    if log_handler is not None:
                        log_handler("[-] Block is not in database.")

def del_block(block_hash, log_handler=None):
    with Mongo_Wrapper() as (alias, db_client):
        with switch_db(Block_db, alias) as Block_db_switch:
            try:
                blocks_to_delete = Block_db_switch.objects(block_hash=block_hash)
            except (CursorNotFound):
                disconnect(alias)
                raise DatabaseQueryFailed("Database query failed for get block hashes")

            if log_handler is not None:
                log_handler("[-] Attempting to delete block with hash: {} from database".format(block_hash.hex()))
            if len(blocks_to_delete) == 1:
                if log_handler is not None:
                    log_handler("[-] Block is already added to database. Deleting")
                block_to_delete = blocks_to_delete[0]
                block_to_delete.delete()
                if log_handler is not None:
                    log_handler("[-] Block deleted")
            else:
                if log_handler is not None:
                    log_handler("[-] Block is not in database.")

def get_tx_db(tx_hash):
    try:
        with Mongo_Wrapper() as (alias, db_client):
            with switch_db(Block_db, alias) as Block_db_switch:
                txs = Block_db_switch.objects(txs__tx_hash=tx_hash).only("txs")[0].txs
                tx = list(filter(lambda tx: tx.tx_hash == tx_hash, txs))[0]
                return tx
    except (CursorNotFound, IndexError):
        disconnect(alias)
        raise DatabaseQueryFailed("Database query failed for tx_hash: {}".format(tx_hash.hex()))

def get_block_from_db(block_doc):
    return Block(
        block_doc.version,
        bytes(block_doc.prev_block),
        bytes(block_doc.merkle_root),
        block_doc.timestamp,
        bytes(block_doc.bits),
        bytes(block_doc.nonce)
    )

def get_db_from_block(block, block_height, block_reward, txs, mined_btc, total_size):
    return Block_db(
        block_hash = block.hash(),
        block_height = block_height,
        block_reward = block_reward,
        version = block.version,
        prev_block = block.prev_block,
        merkle_root = block.merkle_root,
        timestamp = block.timestamp,
        bits = block.bits,
        nonce = block.nonce,
        txs = txs,
        size = block.size(),
        mined_btc = mined_btc,
        total_size = total_size
    )

def get_tx_utxos_in_block(block_txs):
    txs_dict = {}
    for tx in block_txs:
        txs_dict[tx.hash()] = tx
    tx_utxos = []
    for tx in block_txs:
        for tx_in in tx.tx_ins:
            if tx_in.prev_tx in txs_dict.keys():
                if txs_dict[tx_in.prev_tx] not in tx_utxos:
                    tx_utxos.append(txs_dict[tx_in.prev_tx])
    if len(tx_utxos) > 0:
        return tx_utxos
    else:
        return None

def get_tx_in_amount(tx_in, tx_utxos_in_block=None):
    if tx_utxos_in_block:
        try:
            tx = list(filter(lambda tx: tx.hash() == tx_in.prev_tx, tx_utxos_in_block))[0]
            tx_out = tx.tx_outs[tx_in.prev_index]
            return tx_out.amount
        except:
            pass
    tx = get_tx_db(tx_hash=tx_in.prev_tx)
    tx_out = tx.tx_outs[tx_in.prev_index]
    return tx_out.amount

def get_script_doc(script):
    cmds_int = []
    for cmd in script.cmds:
        cmds_int.append(cmd)
    return Script_db(cmds = cmds_int)

def get_witness_doc(witness):
    items_int = []
    for item in witness.items:
        items_int.append(item)
    return Witness_db(items = items_int)

def get_tx_in_doc(tx_in, segwit):
    prev_tx = tx_in.prev_tx
    prev_index = tx_in.prev_index
    script_sig = get_script_doc(tx_in.script_sig)
    sequence = tx_in.sequence
    if segwit:
        witness = get_witness_doc(tx_in.witness)
        return TxIn_db(
            prev_tx = prev_tx,
            prev_index = prev_index,
            script_sig = script_sig,
            sequence = sequence,
            witness = witness
        )
    else:
        return TxIn_db(
            prev_tx = prev_tx,
            prev_index = prev_index,
            script_sig = script_sig,
            sequence = sequence
        )

def get_tx_in_coinbase_doc(tx_in, segwit):
    prev_tx = tx_in.prev_tx
    prev_index = tx_in.prev_index
    script_sig = get_script_doc(tx_in.script_sig)
    sequence = tx_in.sequence
    if segwit:
        witness = get_witness_doc(tx_in.witness)
        return TxInCoinbase_db(
            prev_tx = prev_tx,
            prev_index = prev_index,
            script_sig = script_sig,
            sequence = sequence,
            witness = witness
        )
    else:
        return TxInCoinbase_db(
            prev_tx = prev_tx,
            prev_index = prev_index,
            script_sig = script_sig,
            sequence = sequence
        )

def get_tx_out_doc(tx_out):
    amount = tx_out.amount
    script_pubkey = get_script_doc(tx_out.script_pubkey)
    return TxOut_db(
        amount = amount,
        script_pubkey = script_pubkey,
    )

def get_tx_doc(tx, tx_utxos_in_block=None, coinbase=False):
    tx_ins_doc = []
    for tx_in in tx.tx_ins:
        if coinbase:
            tx_ins_doc.append(get_tx_in_coinbase_doc(tx_in, tx.segwit))
        else:
            tx_ins_doc.append(get_tx_in_doc(tx_in, tx.segwit))
    tx_outs_doc = []
    for tx_out in tx.tx_outs:
        tx_outs_doc.append(get_tx_out_doc(tx_out))
    return Tx_db(
        segwit=tx.segwit,
        tx_hash=tx.hash(),
        version=tx.version,
        tx_ins=tx_ins_doc,
        tx_outs=tx_outs_doc,
        locktime=tx.locktime,
        size=tx.size()
    )
