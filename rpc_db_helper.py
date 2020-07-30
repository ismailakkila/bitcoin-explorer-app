from mongo import Block as Block_db
from mongo import TxReference as TxReference_db
from mongo import TxDetail
from errors import DatabaseQueryFailed, CursorNotFound, NotUniqueError

def get_tx_reference(tx_hash, tx_index):
    try:
        tx_reference_doc = TxReference_db.objects(tx_hash=tx_hash, tx_index=tx_index)
        return tx_reference_doc
    except (CursorNotFound):
        raise DatabaseQueryFailed("Database query failed for tx reference: {}:{}".format(tx_hash.hex(), tx_index))

def get_tx_reference_address_db(address):
    try:
        tx_reference_docs = TxReference_db.objects(address=address)
        if len(tx_reference_docs) > 0:
            return tx_reference_docs
        else:
            raise DatabaseQueryFailed("Not found! Database query for address: {}".format(address.hex()))
    except (CursorNotFound):
        raise DatabaseQueryFailed("Database query failed for address: {}".format(address.hex()))

def get_block_doc_tx_hash(tx_hash):
    try:
        block_doc = Block_db.objects(txs__tx_hash=tx_hash)[0]
        return block_doc
    except (CursorNotFound, IndexError):
        raise DatabaseQueryFailed("Database query failed for block at tx hash: {}".format(tx_hash.hex()))

def get_block_doc_tx_in_hash_prev_index(tx_hash, tx_index):
    try:
        block_doc = Block_db.objects(txs__tx_ins__match={"prev_tx": tx_hash, "prev_index": tx_index})
        return block_doc
    except (CursorNotFound):
        raise DatabaseQueryFailed("Database query failed for block at tx hash: {}".format(tx_hash.hex()))

def get_block_doc_from_block_height(block_height):
    try:
        block_docs = Block_db.objects(block_height__gte=block_height)
        return block_docs
    except (CursorNotFound):
        raise DatabaseQueryFailed("Database query failed for from block height: {}".format(block_height))

def get_block_doc_block_hash(block_hash):
    try:
        block_doc = Block_db.objects(block_hash=block_hash)[0]
        return block_doc
    except (CursorNotFound, IndexError):
        raise DatabaseQueryFailed("Database query failed for block hash: {}".format(block_hash.hex()))

def get_block_doc_block_height(block_height):
    try:
        block_doc = Block_db.objects(block_height=block_height)[0]
        return block_doc
    except (CursorNotFound, IndexError):
        raise DatabaseQueryFailed("Database query failed for block height: {}".format(block_height))

def get_latest_block_db():
    try:
        block = Block_db.objects.order_by("-block_height").first()
        return block
    except (CursorNotFound):
        raise DatabaseQueryFailed("Database query failed for get latest block")

def get_latest_blocks_db():
    try:
        blocks = Block_db.objects.order_by("-block_height")[:10]
        return blocks
    except (CursorNotFound, IndexError):
        raise DatabaseQueryFailed("Database query failed for get latest blocks")

def get_tx_db(tx_hash):
    try:
        block = Block_db.objects(txs__tx_hash=tx_hash)[0]
        txs = block.txs
        tx = list(filter(lambda tx: tx.tx_hash == tx_hash, txs))[0]
        tx = TxDetail(
            block_hash = block.block_hash,
            block_height = block.block_height,
            timestamp = block.timestamp,
            segwit = tx.segwit,
            tx_hash = tx.tx_hash,
            version = tx.version,
            tx_ins = tx.tx_ins,
            tx_outs = tx.tx_outs,
            locktime = tx.locktime,
            size = tx.size
        )
        return tx
    except (CursorNotFound, IndexError):
        raise DatabaseQueryFailed("Database query failed for tx_hash: {}".format(tx_hash.hex()))
