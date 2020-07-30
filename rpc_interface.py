from gevent import monkey
monkey.patch_all()

import zerorpc
import json
import os
import logging
import base64
import uuid
from helper import decode_base58
from errors import DatabaseQueryFailed
from mongo import connect_default_db
from mongoengine import disconnect_all
from multiprocessing import Event
from check_args import (
    check_argv,
    save_config_file,
    check_folder,
    ARG_VAL_NUMERIC,
    ARG_VAL_LOG,
    ARG_VAL_TYPE_LOG,
    ARG_VAL_TYPE_DEFAULT
)
from rpc_db_helper import (
    get_latest_blocks_db,
    get_latest_block_db,
    get_block_doc_block_hash,
    get_block_doc_block_height,
    get_tx_db,
    get_tx_reference_address_db,
    get_tx_reference,
    get_block_doc_tx_in_hash_prev_index,
    get_block_doc_tx_hash
)

RPC_FILE = "rpc.log"
CONFIG_FILE = ".config"
SYNC_FILE = ".sync"
RPC_PORT = 8999
ALLOWED_ARG_TYPES = [
    "host",
    "port",
    "log",
    "tor"
]

def sanitize(data):

    def decode_binary_base64(data):
        return base64.decodebytes(data.encode())

    if type(data) == dict:
        sanitized_data_dict = {}
        match_bytes = ["$binary", "$type"] == list(data.keys()) and data["$type"] == "00"
        if match_bytes:
            b64_encoded = data["$binary"]
            b64_decoded = decode_binary_base64(b64_encoded).hex()
            return b64_decoded
        else:
            for key in data:
                if key in ["_id", "$oid", "_cls"]:
                    continue
                elif type(data[key]) not in [dict, list]:
                    sanitized_data_dict[key] = data[key]
                else:
                    result = sanitize(data[key])
                    if result is None:
                        continue
                    else:
                        sanitized_data_dict[key] = result
            if sanitized_data_dict == {}:
                return None
            else:
                return sanitized_data_dict
    elif type(data) == list:
        sanitized_data_list = []
        for item in data:

            result = sanitize(item)
            if result is None:
                continue
            else:
                sanitized_data_list.append(result)
        if sanitized_data_list == []:
            return None
        else:
            return sanitized_data_list
    else:
        return data

def start_log(log_level="INFO"):
    path = check_folder(dist_mode)
    logging.basicConfig(
        format='%(asctime)s %(levelname)s:%(message)s',
        filename=os.path.join(path, RPC_FILE),
        level=getattr(logging, log_level),
        filemode='w',
    )

def disconnect_db_clients():
    logging.info("[-] Disconnecting default database client connection")
    db_default_client.close()
    disconnect_all()

def start_rpc_server():
    s = zerorpc.Server(RPCInterface(), heartbeat=None)
    logging.info("[-] Starting RPC server")
    try:
        s.bind("tcp://0.0.0.0:" + str(RPC_PORT))
        return s
    except Exception as err:
        raise(err)

def stop_rpc_server():
    logging.info("[-] Stopping RPC server")
    rpc_server.stop()
    rpc_server.close()

def clear_events():
    to_be_deleted = []
    for id in operation_events:
        while operation_events[id].is_set():
            operation_events[id].clear()
            to_be_deleted.append(id)
    for id in to_be_deleted:
        del operation_events[id]

def check_config_params(configParams):
    allowed_keys = all(list(map(lambda key: key in ALLOWED_ARG_TYPES, configParams.keys())))
    valid_args = {}
    for key in configParams:
        if key in ARG_VAL_NUMERIC:
            if configParams[key].isnumeric():
                valid_args[key] = int(configParams[key])
        elif key in ARG_VAL_LOG:
            if configParams[key] not in ARG_VAL_TYPE_LOG:
                valid_args[key] = ARG_VAL_TYPE_DEFAULT
            else:
                valid_args[key] = configParams[key]
        else:
            valid_args[key] = configParams[key]
    return valid_args

def process_value(value):

    def check_format_hex_to_hash(hex_string, bytes_length):
        if type(hex_string) == str and len(hex_string) == bytes_length * 2:
            try:
                val_bytes = bytes.fromhex(hex_string)
                assert len(val_bytes) == bytes_length, None
                return val_bytes
            except (ValueError, AssertionError):
                return False
        return False

    def check_format_hex(hex_string):

        def is_type_base58_address(hex_string):
            if type(hex_string) == str:
                if (hex_string[0] == "1" or hex_string[0] == "3") and len(hex_string) == 34:
                    try:
                        decoded_address = decode_base58(hex_string)
                        return check_format_hex_to_hash(decoded_address.hex(), 20)
                    except (ValueError, AssertionError):
                        return False
            return False

        def is_type_p2pk_uncompressed(hex_string):
            return check_format_hex_to_hash(hex_string, 65)

        def is_type_p2pk_compressed(hex_string):
            return check_format_hex_to_hash(hex_string, 33)

        def is_type_p2pkh_p2psh_p2wpkh(hex_string):
            return check_format_hex_to_hash(hex_string, 20)

        def is_type_p2wsh_block_tx(hex_string):
            return check_format_hex_to_hash(hex_string, 32)

        address = is_type_p2pk_uncompressed(hex_string)
        if address:
            return address
        address = is_type_p2pk_compressed(hex_string)
        if address:
            return address
        address = is_type_base58_address(hex_string)
        if address:
            return address
        address = is_type_p2pkh_p2psh_p2wpkh(hex_string)
        if address:
            return address
        address = is_type_p2wsh_block_tx(hex_string)
        if address:
            return address
        return False

    if type(value) == int and value >= 0:
        return ("block_height", value)
    else:
        hash = check_format_hex(value)
        if hash:
            return ("hash", hash)
    return False


class RPCInterface(object):

    def get_config(self):
        logging.info("[-] Incoming RPC request - get_config")
        path = check_folder(dist_mode)
        if os.path.exists(os.path.join(path,CONFIG_FILE)):
            with open(os.path.join(path,CONFIG_FILE), "r") as f:
                try:
                    config_vars = {}
                    for line in f.readlines():
                        config_var = line.split("=")
                        if len(config_var) > 1:
                            config_vars[config_var[0]] = config_var[1].split("\n")[0]
                        else:
                            config_vars[config_var[0]] = True
                    result = {
                        "type": "config",
                        "data": config_vars
                    }
                    logging.debug(result)
                    return json.dumps(result)
                except:
                    result = {
                        "type": "error",
                        "data": "error reading config file"
                    }
                    logging.debug(result)
                    return json.dumps(result)
        else:
            result = {
                "type": "error",
                "data": "config file does not exist"
            }
            logging.info(result)
            return json.dumps(result)

    def modify_config(self, configParams):
        logging.info("[-] Incoming RPC request - modify_config: {}".format(configParams))
        try:
            save_config_file(check_config_params(configParams), dist_mode=dist_mode)
            return self.get_config()
        except:
            result = {
                "type": "error",
                "data": "error modifying config file"
            }
            logging.info(result)
            return json.dumps(result)

    def get_sync_status(self):
        logging.info("[-] Incoming RPC request - get_sync_status")
        path = check_folder(dist_mode)
        if os.path.exists(os.path.join(path, SYNC_FILE)):
            with open(os.path.join(path, SYNC_FILE), "r") as f:
                try:
                    latest_block = get_latest_block_db()
                    latest_block_height = latest_block.block_height
                    text = f.read()
                    if text == "TRUE":
                        result = {
                            "type": "status",
                            "data": "syncing: block height " + str(latest_block_height)
                        }
                        logging.info(result)
                        return json.dumps(result)
                    elif text == "FALSE":
                        result = {
                            "type": "status",
                            "data": "not syncing: block height " + str(latest_block_height)
                        }
                        logging.info(result)
                        return json.dumps(result)
                    else:
                        result = {
                            "type": "status",
                            "data": "unknown: block_height " + str(latest_block_height)
                        }
                        logging.info(result)
                        return json.dumps(result)
                except (DatabaseQueryFailed) as err:
                    result = {
                        "type": "error",
                        "data": err.args[0]
                    }
                    logging.info(result)
                    return json.dumps(result)
                except:
                    result = {
                        "type": "error",
                        "data": "error reading sync file"
                    }
                    logging.info(result)
                    return json.dumps(result)
        else:
            result = {
                "type": "error",
                "data": "sync file does not exist"
            }
            logging.info(result)
            return json.dumps(result)

    def get_latest_blocks(self):
        logging.info("[-] Incoming RPC request - get_latest_blocks")
        try:
            blocks = get_latest_blocks_db()
            blocks = [json.loads(b.to_json()) for b in blocks]
            result = {
                "type": "block",
                "data": blocks
            }
            result = sanitize(result)
            logging.info("[-] Successful Response: Incoming RPC request - get_latest_blocks")
            logging.debug(result)
            return json.dumps(result)
        except DatabaseQueryFailed as err:
            result = {
                "type": "error",
                "data": err.args[0]
            }
            logging.info(result)
            return json.dumps(result)

    def get_utxo_status(self, event_id, tx_hash, tx_index):
        logging.info("[-] Incoming RPC request - get_utxo_status: {}:{}".format(tx_hash, tx_index))
        if event_id in operation_events.keys() and operation_events[event_id].is_set():
            try:
                result = process_value(tx_hash)
                if result:
                    if result[0] == "hash":
                        tx_hash = result[1]
                        tx_reference_doc = get_tx_reference(tx_hash, tx_index)
                        if len(tx_reference_doc) > 0:
                            block_doc = get_block_doc_tx_in_hash_prev_index(tx_hash, tx_index)
                            if len(block_doc) > 0:
                                block_doc = json.loads(block_doc[0].to_json())
                                result = {
                                        "type": "block",
                                        "data": block_doc
                                }
                                result = sanitize(result)
                                logging.debug(result)
                                return json.dumps(result)
                        result = {
                            "type": "block",
                            "data": {}
                        }
                        logging.info("[-] Successful Response: Incoming RPC request - get_utxo_status: {}:{}".format(tx_hash, tx_index))
                        logging.debug(result)
                        return json.dumps(result)
                result = {
                    "type": "error",
                    "data": "passed value format is not correct"
                }
                logging.info(result)
                return json.dumps(result)
            except DatabaseQueryFailed as err:
                result = {
                    "type": "error",
                    "data": err.args[0]
                }
                logging.info(result)
                return json.dumps(result)

    @zerorpc.stream
    def get_utxo_status_stream(self, event_id, tx_hash_index_pairs):
        logging.info("[-] Incoming RPC request - get_utxo_status_stream: {} items".format(len(tx_hash_index_pairs)))
        for pair in tx_hash_index_pairs:
            if event_id in operation_events.keys() and operation_events[event_id].is_set():
                try:
                    tx_hash = pair["tx_hash"]
                    tx_index = pair["tx_index"]
                    result = process_value(tx_hash)
                    if result:
                        if result[0] == "hash":
                            tx_hash = result[1]
                            tx_reference_doc = get_tx_reference(tx_hash, tx_index)
                            if len(tx_reference_doc) > 0:
                                block_doc = get_block_doc_tx_in_hash_prev_index(tx_hash, tx_index)
                                if len(block_doc) > 0:
                                    block_doc = json.loads(block_doc[0].to_json())
                                    result = {
                                            "type": "block",
                                            "data": block_doc
                                    }
                                    result = sanitize(result)
                                    logging.info("[-] Successful Response: Incoming RPC request - get_utxo_status_stream: {} items".format(len(tx_hash_index_pairs)))
                                    logging.debug(result)
                                    yield json.dumps(result)
                                    continue
                            result = {
                                "type": "block",
                                "data": {}
                            }
                            logging.info("[-] Successful Response: Incoming RPC request - get_utxo_status_stream: {} items".format(len(tx_hash_index_pairs)))
                            logging.debug(result)
                            yield json.dumps(result)
                            continue
                    result = {
                        "type": "error",
                        "data": "passed value format is not correct"
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
                except DatabaseQueryFailed as err:
                    result = {
                        "type": "error",
                        "data": err.args[0]
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
            else:
                break

    def get_tx_block(self, event_id, tx_hash):
        logging.info("[-] Incoming RPC request - get_tx_block: {}".format(tx_hash))
        if event_id in operation_events.keys() and operation_events[event_id].is_set():
            try:
                result = process_value(tx_hash)
                if result:
                    if result[0] == "hash":
                        tx_hash = result[1]
                        block_doc = get_block_doc_tx_hash(tx_hash)
                        block_doc = json.loads(block_doc.to_json())
                        result = {
                            "type": "block",
                            "data": block_doc
                        }
                        result = sanitize(result)
                        logging.info("[-] Successful Response: Incoming RPC request - get_tx_block: {}".format(tx_hash))
                        logging.debug(result)
                        return json.dumps(result)
                result = {
                    "type": "error",
                    "data": "passed value format is not correct"
                }
                logging.info(result)
                return json.dumps(result)
            except DatabaseQueryFailed as err:
                result = {
                    "type": "error",
                    "data": err.args[0]
                }
                logging.info(result)
                return json.dumps(result)

    @zerorpc.stream
    def get_tx_block_stream(self, event_id, tx_hashes):
        logging.info("[-] Incoming RPC request - get_tx_block_stream: {} items".format(len(tx_hashes)))
        for tx_hash in tx_hashes:
            if event_id in operation_events.keys() and operation_events[event_id].is_set():
                try:
                    result = process_value(tx_hash)
                    if result:
                        if result[0] == "hash":
                            tx_hash = result[1]
                            block_doc = get_block_doc_tx_hash(tx_hash)
                            block_doc = json.loads(block_doc.to_json())
                            result = {
                                "type": "block",
                                "data": block_doc
                            }
                            result = sanitize(result)
                            logging.info("[-] Successful Response: Incoming RPC request - get_tx_block_stream: {} items".format(len(tx_hashes)))
                            logging.debug(result)
                            yield json.dumps(result)
                            continue
                    result = {
                        "type": "error",
                        "data": "passed value format is not correct"
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
                except DatabaseQueryFailed as err:
                    result = {
                        "type": "error",
                        "data": err.args[0]
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
            else:
                break

    def cancel(self):
        clear_events()
        return True

    def get_new_attribute(self, id):
        logging.info("[-] Incoming RPC request - get_attribute: {}".format(id))
        try:
            result = process_value(id)
            if result:
                clear_events()
                current_event = Event()
                current_event.set()
                current_event_id = str(uuid.uuid4())
                operation_events[current_event_id] = current_event

                if result[0] == "block_height":
                    block_height = result[1]
                    block_doc = get_block_doc_block_height(block_height)
                    block_doc = json.loads(block_doc.to_json())
                    result = {
                        "event_id": current_event_id,
                        "type": "block",
                        "data": block_doc
                    }
                    result = sanitize(result)
                    logging.info("[-] Successful Response: Incoming RPC request - get_attribute: {}".format(id))
                    logging.debug(result)
                    return json.dumps(result)
                if result[0] == "hash":
                    hash = result[1]
                    try:
                        tx_reference_docs = get_tx_reference_address_db(hash)
                        tx_references = [(doc.tx_hash, doc.tx_index) for doc in tx_reference_docs]
                        utxos = [{"tx_hash":ref[0].hex(), "tx_index": ref[1]} for ref in tx_references]
                        tx_docs = [get_tx_db(doc[0]) for doc in tx_references]

                        total_balance = 0
                        for i in range(0, len(tx_references)):
                            tx_hash = tx_references[i][0]
                            tx_index = tx_references[i][1]
                            tx = tx_docs[i]
                            if tx.tx_hash == tx_hash:
                                total_balance += tx.tx_outs[tx_index].amount

                        tx_docs = [json.loads(doc.to_json()) for doc in tx_docs]
                        result = {
                            "event_id": current_event_id,
                            "type": "address",
                            "data": {
                                "address_b58": id,
                                "address_raw": tx_reference_docs[0]["address"].hex(),
                                "total_balance": total_balance,
                                "utxos": utxos,
                                "txs": tx_docs
                            }
                        }
                        result = sanitize(result)
                        logging.info("[-] Successful Response: Incoming RPC request - get_attribute: {}".format(id))
                        logging.debug(result)
                        return json.dumps(result)
                    except (DatabaseQueryFailed, IndexError) as fetch_address_err:
                        err = [str(fetch_address_err)]
                        try:
                            tx_doc = get_tx_db(hash)
                            tx_doc = json.loads(tx_doc.to_json())
                            result = {
                                "event_id": current_event_id,
                                "type": "tx",
                                "data": tx_doc
                            }
                            result = sanitize(result)
                            logging.info("[-] Successful Response: Incoming RPC request - get_attribute: {}".format(id))
                            logging.debug(result)
                            return json.dumps(result)
                        except (DatabaseQueryFailed, IndexError) as fetch_tx_err:
                            err.append(str(fetch_tx_err))
                            try:
                                block_doc = get_block_doc_block_hash(hash)
                                block_doc = json.loads(block_doc.to_json())
                                result = {
                                    "event_id": current_event_id,
                                    "type": "block",
                                    "data": block_doc
                                }
                                result = sanitize(result)
                                logging.info("[-] Successful Response: Incoming RPC request - get_attribute: {}".format(id))
                                logging.debug(result)
                                return json.dumps(result)
                            except (DatabaseQueryFailed, IndexError) as fetch_block_err:
                                err.append(str(fetch_block_err))
                                raise DatabaseQueryFailed(err)
            result = {
                "type": "error",
                "data": "passed value format is not correct"
            }
            logging.info(result)
            return json.dumps(result)
        except DatabaseQueryFailed as err:
            result = {
                "type": "error",
                "data": err.args[0]
            }
            logging.info(result)
            return json.dumps(result)

    def get_update_attribute(self, event_id, id):
        logging.info("[-] Incoming RPC request - get_update_attribute: {}".format(id))
        if event_id in operation_events.keys() and operation_events[event_id].is_set():
            try:
                result = process_value(id)
                if result:
                    if result[0] == "block_height":
                        block_height = result[1]
                        block_doc = get_block_doc_block_height(block_height)
                        block_doc = json.loads(block_doc.to_json())
                        result = {
                            "type": "block",
                            "data": block_doc
                        }
                        result = sanitize(result)
                        logging.info("[-] Successful Response: Incoming RPC request - get_update_attribute: {}".format(id))
                        logging.debug(result)
                        return json.dumps(result)
                    if result[0] == "hash":
                        hash = result[1]
                        try:
                            tx_reference_docs = get_tx_reference_address_db(hash)
                            tx_references = [(doc.tx_hash, doc.tx_index) for doc in tx_reference_docs]
                            utxos = [{"tx_hash":ref[0].hex(), "tx_index": ref[1]} for ref in tx_references]
                            tx_docs = [get_tx_db(doc[0]) for doc in tx_references]

                            total_balance = 0
                            for i in range(0, len(tx_references)):
                                tx_hash = tx_references[i][0]
                                tx_index = tx_references[i][1]
                                tx = tx_docs[i]
                                if tx.tx_hash == tx_hash:
                                    total_balance += tx.tx_outs[tx_index].amount

                            tx_docs = [json.loads(doc.to_json()) for doc in tx_docs]
                            result = {
                                "type": "address",
                                "data": {
                                    "address_b58": id,
                                    "address_raw": tx_reference_docs[0]["address"].hex(),
                                    "total_balance": total_balance,
                                    "utxos": utxos,
                                    "txs": tx_docs
                                }
                            }
                            result = sanitize(result)
                            logging.info("[-] Successful Response: Incoming RPC request - get_update_attribute: {}".format(id))
                            logging.debug(result)
                            return json.dumps(result)
                        except (DatabaseQueryFailed, IndexError) as fetch_address_err:
                            err = [str(fetch_address_err)]
                            try:
                                tx_doc = get_tx_db(hash)
                                tx_doc = json.loads(tx_doc.to_json())
                                result = {
                                    "type": "tx",
                                    "data": tx_doc
                                }
                                result = sanitize(result)
                                logging.info("[-] Successful Response: Incoming RPC request - get_update_attribute: {}".format(id))
                                logging.debug(result)
                                return json.dumps(result)
                            except (DatabaseQueryFailed, IndexError) as fetch_tx_err:
                                err.append(str(fetch_tx_err))
                                try:
                                    block_doc = get_block_doc_block_hash(hash)
                                    block_doc = json.loads(block_doc.to_json())
                                    result = {
                                        "type": "block",
                                        "data": block_doc
                                    }
                                    result = sanitize(result)
                                    logging.info("[-] Successful Response: Incoming RPC request - get_update_attribute: {}".format(id))
                                    logging.debug(result)
                                    return json.dumps(result)
                                except (DatabaseQueryFailed, IndexError) as fetch_block_err:
                                    err.append(str(fetch_block_err))
                                    raise DatabaseQueryFailed(err)
                result = {
                    "type": "error",
                    "data": "passed value format is not correct"
                }
                logging.info(result)
                return json.dumps(result)
            except DatabaseQueryFailed as err:
                result = {
                    "type": "error",
                    "data": err.args[0]
                }
                logging.info(result)
                return json.dumps(result)

    @zerorpc.stream
    def get_update_attribute_stream(self, event_id, ids):
        logging.info("[-] Incoming RPC request - get_attribute_stream: {} items".format(len(ids)))
        for id in ids:
            if event_id in operation_events.keys() and operation_events[event_id].is_set():
                try:
                    result = process_value(id)
                    if result:
                        if result[0] == "block_height":
                            block_height = result[1]
                            block_doc = get_block_doc_block_height(block_height)
                            block_doc = json.loads(block_doc.to_json())
                            result = {
                                "type": "block",
                                "data": block_doc
                            }
                            result = sanitize(result)
                            logging.info("[-] Successful Response: Incoming RPC request - get_attribute_stream: {} items".format(len(ids)))
                            logging.debug(result)
                            yield json.dumps(result)
                            continue
                        if result[0] == "hash":
                            hash = result[1]
                            try:
                                tx_reference_docs = get_tx_reference_address_db(hash)
                                tx_references = [(doc.tx_hash, doc.tx_index) for doc in tx_reference_docs]
                                utxos = [{"tx_hash":ref[0].hex(), "tx_index": ref[1]} for ref in tx_references]
                                tx_docs = [get_tx_db(doc[0]) for doc in tx_references]

                                total_balance = 0
                                for i in range(0, len(tx_references)):
                                    tx_hash = tx_references[i][0]
                                    tx_index = tx_references[i][1]
                                    tx = tx_docs[i]
                                    if tx.tx_hash == tx_hash:
                                        total_balance += tx.tx_outs[tx_index].amount

                                tx_docs = [json.loads(doc.to_json()) for doc in tx_docs]
                                result = {
                                    "type": "address",
                                    "data": {
                                        "address_b58": id,
                                        "address_raw": tx_reference_docs[0]["address"].hex(),
                                        "total_balance": total_balance,
                                        "utxos": utxos,
                                        "txs": tx_docs
                                    }
                                }
                                result = sanitize(result)
                                logging.info("[-] Successful Response: Incoming RPC request - get_attribute_stream: {} items".format(len(ids)))
                                logging.debug(result)
                                yield json.dumps(result)
                                continue
                            except (DatabaseQueryFailed, IndexError) as fetch_address_err:
                                err = [str(fetch_address_err)]
                                try:
                                    tx_doc = get_tx_db(hash)
                                    tx_doc = json.loads(tx_doc.to_json())
                                    result = {
                                        "type": "tx",
                                        "data": tx_doc
                                    }
                                    result = sanitize(result)
                                    logging.info("[-] Successful Response: Incoming RPC request - get_attribute_stream: {} items".format(len(ids)))
                                    logging.debug(result)
                                    yield json.dumps(result)
                                    continue
                                except (DatabaseQueryFailed, IndexError) as fetch_tx_err:
                                    err.append(str(fetch_tx_err))
                                    try:
                                        block_doc = get_block_doc_block_hash(hash)
                                        block_doc = json.loads(block_doc.to_json())
                                        result = {
                                            "type": "block",
                                            "data": block_doc
                                        }
                                        result = sanitize(result)
                                        logging.info("[-] Successful Response: Incoming RPC request - get_attribute_stream: {} items".format(len(ids)))
                                        logging.debug(result)
                                        yield json.dumps(result)
                                        continue
                                    except (DatabaseQueryFailed, IndexError) as fetch_block_err:
                                        err.append(str(fetch_block_err))
                                        raise DatabaseQueryFailed(err)
                    result = {
                        "type": "error",
                        "data": "passed value format is not correct"
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
                except DatabaseQueryFailed as err:
                    result = {
                        "type": "error",
                        "data": err.args[0]
                    }
                    logging.info(result)
                    yield json.dumps(result)
                    continue
            else:
                break


if __name__ == "__main__":
    try:
        host, port, log_level, tor, dist_mode = check_argv()
        logger = start_log(log_level=log_level)
        db_default_client = connect_default_db()
        operation_events = {}
        rpc_server = start_rpc_server()
        rpc_server.run()
    except KeyboardInterrupt:
        clear_events()
        disconnect_db_clients()
        stop_rpc_server()
