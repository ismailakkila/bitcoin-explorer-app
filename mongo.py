import os
import sys
import logging
from check_args import is_dist_mode, check_folder
from mongoengine import     \
                connect,    \
                register_connection, \
                Document,   \
                EmbeddedDocument,   \
                EmbeddedDocumentField,  \
                EmbeddedDocumentListField,  \
                ListField,  \
                IntField,   \
                BinaryField,\
                DynamicField,   \
                BooleanField

ENV_FILE = ".env"

def parse_env():
    path = check_folder(is_dist_mode())
    if os.path.exists(os.path.join(path, ENV_FILE)):
        with open(os.path.join(path, ENV_FILE), "r") as f:
            try:
                env_vars = {}
                for line in f.readlines():
                    env_vars[line.split("=")[0]] = line.split("=")[1].split("\n")[0]
            except:
                logging.critical("[!] Unable to read .env file")
                sys.exit(1)
    else:
        logging.info("[*] .env file does not exist. Creating default .env file")
        with open(os.path.join(path, ENV_FILE), "w") as f:
            try:
                f.write("DATABASE_HOST=127.0.0.1" + "\n")
                f.write("DATABASE_PORT=27017" + "\n")
            except:
                logging.critical("[*] Unable to write default .env file.")
                sys.exit(1)
        with open(os.path.join(path, ENV_FILE), "r") as f:
            try:
                env_vars = {}
                for line in f.readlines():
                    env_vars[line.split("=")[0]] = line.split("=")[1].split("\n")[0]
            except:
                logging.critical("[!] Unable to read .env file")
                sys.exit(1)
    try:
        if "DATABASE_HOST" in env_vars.keys() and "DATABASE_PORT" in env_vars.keys():
            DATABASE_HOST = env_vars["DATABASE_HOST"]
            DATABASE_PORT = int(env_vars["DATABASE_PORT"])
            return DATABASE_HOST, DATABASE_PORT
    except:
        logging.critical("[!] Incorrect environment variables set")
        sys.exit(1)

def connect_default_db():
    DATABASE_HOST, DATABASE_PORT = parse_env()
    logging.info("[-] Attempting default connection to database")
    db_client = connect("bitcoin", alias="default", host=DATABASE_HOST, port=DATABASE_PORT, connect=True)
    logging.info("[-] Connecting to database {}:{}".format(DATABASE_HOST, str(DATABASE_PORT)))
    return db_client

def connect_db(alias):
    DATABASE_HOST, DATABASE_PORT = parse_env()
    db_client = connect("bitcoin", alias=alias, host=DATABASE_HOST, port=DATABASE_PORT)
    return db_client

def register_db(alias):
    DATABASE_HOST, DATABASE_PORT = parse_env()
    register_connection(alias, db="bitcoin", host=DATABASE_HOST, port=DATABASE_PORT)

class Script(EmbeddedDocument):
    cmds = ListField(DynamicField(required=False), required=True)

class Witness(EmbeddedDocument):
    items = ListField(DynamicField(required=True), required=True)

class TxIn(EmbeddedDocument):
    prev_tx = BinaryField(required=True, unique_with="prev_index")
    prev_index = IntField(required=True)
    script_sig = EmbeddedDocumentField(Script, required=True)
    witness = EmbeddedDocumentField(Witness, required=False)
    sequence = IntField(required=True)

class TxInCoinbase(EmbeddedDocument):
    prev_tx = BinaryField(required=True)
    prev_index = IntField(required=True)
    script_sig = EmbeddedDocumentField(Script, required=True)
    witness = EmbeddedDocumentField(Witness, required=False)
    sequence = IntField(required=True)

class TxOut(EmbeddedDocument):
    amount = IntField(required=True)
    script_pubkey = EmbeddedDocumentField(Script, required=True)

class Tx(EmbeddedDocument):
    segwit = BooleanField(required=True)
    tx_hash = BinaryField(unique=True, required=True)
    version = IntField(required=True)
    tx_ins = ListField(DynamicField(required=True), required=True)
    tx_outs = EmbeddedDocumentListField(TxOut, required=True)
    locktime = IntField(required=True)
    size = IntField(required=True)

class TxDetail(EmbeddedDocument):
    block_hash = BinaryField(unique=True, required=True)
    block_height = IntField(unique=True, required=True)
    timestamp = IntField(required=True)
    segwit = BooleanField(required=True)
    tx_hash = BinaryField(unique=True, required=True)
    version = IntField(required=True)
    tx_ins = ListField(DynamicField(required=True), required=True)
    tx_outs = EmbeddedDocumentListField(TxOut, required=True)
    locktime = IntField(required=True)
    size = IntField(required=True)

class TxReference(Document):
    tx_hash = BinaryField(required=True, unique_with="tx_index")
    tx_index = IntField(required=True)
    address = BinaryField(required=True)

class Block(Document):
    block_hash = BinaryField(unique=True, required=True)
    version = IntField(required=True)
    prev_block = BinaryField(required=True)
    merkle_root = BinaryField(required=True)
    timestamp = IntField(required=True)
    bits = BinaryField(required=True)
    nonce = BinaryField(required=True)
    txs = EmbeddedDocumentListField(Tx, required=True)
    block_height = IntField(unique=True, required=True)
    size = IntField(required=True)
    block_reward = IntField(required=True)
    mined_btc = IntField(required=True)
    total_size = IntField(required=True)
