from tx import Tx, TxIn, TxOut
from script import Script
from block import Block_Full
from mongo import Script as Script_db
from mongo import Witness as Witness_db
from mongo import TxIn as TxIn_db
from mongo import TxOut as TxOut_db
from mongo import Tx as Tx_db
from mongo import Block as Block_db

GENESIS_BLOCK_HASH = bytes.fromhex("000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f")
GENESIS_BLOCK_REWARD = 50 * 100000000
GENESIS_BLOCK_HEIGHT = 0
GENESIS_BLOCK_MERKLE_ROOT = bytes.fromhex("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b")
GENESIS_BLOCK_TIMESTAMP = 1231006505
GENESIS_BLOCK_BITS = bytes.fromhex("00ffff")[::-1] + bytes.fromhex("1d")
GENESIS_BLOCK_NONCE = bytes.fromhex("7c2bac1d")[::-1]
GENESIS_THE_TIMES = bytes.fromhex("5468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73")
GENESIS_SEC_PUBKEY = bytes.fromhex("04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f")

def save_genesis_block():

    script_sig = Script([
        bytes.fromhex("ffff001d"),
        bytes.fromhex("04"),
        GENESIS_THE_TIMES
    ])

    script_pubkey = Script([
        GENESIS_SEC_PUBKEY,
        0xac
    ])

    tx_in = TxIn(
        prev_tx=b"\x00" * 32,
        prev_index=0xffffffff,
        script_sig=script_sig,
        sequence=0xffffffff
    )

    tx_out = TxOut(
        amount=GENESIS_BLOCK_REWARD,
        script_pubkey=script_pubkey
    )

    tx = Tx(
        version=1,
        tx_ins=[tx_in],
        tx_outs=[tx_out],
        locktime=0
    )

    block = Block_Full(
        version=1,
        prev_block=b"\x00" * 32,
        merkle_root=GENESIS_BLOCK_MERKLE_ROOT,
        timestamp=GENESIS_BLOCK_TIMESTAMP,
        bits=GENESIS_BLOCK_BITS,
        nonce=GENESIS_BLOCK_NONCE,
        txs=[tx]
    )

    tx = block.txs[0]
    script_sig_cmds = tx.tx_ins[0].script_sig.cmds
    script_pubkey_cmds = tx.tx_outs[0].script_pubkey.cmds
    GENESIS_SCRIPT_SIG_DB = Script_db(cmds=script_sig_cmds)
    GENESIS_SCRIPT_PUBKEY_DB = Script_db(cmds=script_pubkey_cmds)
    tx_in = tx.tx_ins[0]
    GENESIS_TX_IN_DB = TxIn_db(
        prev_tx=tx_in.prev_tx,
        prev_index=tx_in.prev_index,
        script_sig=GENESIS_SCRIPT_SIG_DB,
        sequence = tx_in.sequence
    )

    tx_out = tx.tx_outs[0]
    GENESIS_TX_OUT_DB = TxOut_db(
        amount=tx_out.amount,
        script_pubkey=GENESIS_SCRIPT_PUBKEY_DB
    )

    tx_size = len(tx.serialize())

    GENESIS_TX_DB = Tx_db(
        segwit=False,
        tx_hash=tx.hash(),
        version=tx.version,
        tx_ins=[GENESIS_TX_IN_DB],
        tx_outs=[GENESIS_TX_OUT_DB],
        locktime=tx.locktime,
        size=tx_size
    )

    block_size = block.size()
    try:
        GENESIS_BLOCK_DB = Block_db(
            block_hash=GENESIS_BLOCK_HASH,
            block_height=0,
            block_reward=GENESIS_BLOCK_REWARD,
            version=1,
            prev_block=b"\x00" * 32,
            merkle_root=GENESIS_BLOCK_MERKLE_ROOT,
            timestamp=GENESIS_BLOCK_TIMESTAMP,
            bits=GENESIS_BLOCK_BITS,
            nonce=GENESIS_BLOCK_NONCE,
            txs=[GENESIS_TX_DB],
            size=block_size,
            mined_btc=GENESIS_BLOCK_REWARD,
            total_size=block_size
        ).save()
    except:
        pass
