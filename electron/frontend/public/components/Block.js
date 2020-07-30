const blockStyles = {
  main: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  title: {
    margin: "10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    wordBreak: "break-all"
  },
  buttonsRow: {
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  buttonsRowNext: {
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  buttonsRowPrev: {
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  button: {
    fontFamily: "monospace"
  },
  upper: {
    margin: "10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  upperRow: {
    borderTop: "1px solid",
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemStart: {
    margin: "5px",
    textAlign: "left"
  },
  itemEnd: {
    margin: "5px",
    fontWeight: "bold",
    wordBreak: "break-all",
    textAlign: "right"
  },
  navRow: {
    padding: "5px",
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  navItem: {
    margin: "3px"
  },
  navText: {
    fontWeight: "bold",
  },
  itemTextLink: {
    cursor: "pointer",
    textDecoration: "underline"
  },
};

const SHOWMOREITEMS = 50;
const SHOWLESSITEMS = 10;

class Block extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      numItemsPage: SHOWLESSITEMS,
      currentPageIndex: 0,
      showMore: false,
      updatingUtxoStatus: true,
      chunkItem: 2,
      chunkBatch: 10,
      txinAmountsStatus: null,
      txinAmountsBatches: [],
      txFees: []
    };
    this.handlePreviousBlock = this.handlePreviousBlock.bind(this);
    this.handleNextBlock = this.handleNextBlock.bind(this);
    this.handlePreviousPage = this.handlePreviousPage.bind(this);
    this.handleNextPage = this.handleNextPage.bind(this);
    this.toggleShowMore = this.toggleShowMore.bind(this);
    this.addTxFee = this.addTxFee.bind(this);
  }

  handlePreviousBlock() {
    this.props.getData(this.props.block.block_height - 1);
  }

  handleNextBlock() {
    this.props.getData(this.props.block.block_height + 1);
  }

  handlePreviousPage() {
    this.setState((state, props) => {
      if (state.currentPageIndex > 0) {
        return {
          currentPageIndex: state.currentPageIndex - 1
        };
      }
    });
  }

  handleNextPage() {
    let totalPages = Math.ceil(
      this.props.block.txs.length / this.state.numItemsPage
    );
    this.setState((state, props) => {
      if (state.currentPageIndex < totalPages - 1) {
        return {
          currentPageIndex: state.currentPageIndex + 1
        };
      }
    });
  }

  toggleShowMore() {
    this.setState((state, props) => {
      if (state.showMore) {
        return {
          numItemsPage: SHOWLESSITEMS,
          currentPageIndex: 0,
          showMore: false
        };
      }
      else {
        return {
          numItemsPage: SHOWMOREITEMS,
          currentPageIndex: 0,
          showMore: true
        };
      }
    });
  }

  addTxFee(fees) {
    this.state.txFees.push(fees);
  }

  render() {

    let {
      block_height,
      block_hash,
      version,
      prev_block,
      merkle_root,
      timestamp,
      bits,
      nonce,
      size,
      block_reward,
      txs
    } = this.props.block;

    let {
      numItemsPage,
      currentPageIndex
    } = this.state;

    let totalPages = Math.ceil(
      this.props.block.txs.length / this.state.numItemsPage
    );

    let firstIndex = currentPageIndex * numItemsPage;
    let lastIndex =  firstIndex + (numItemsPage - 1);

    let txs_jsx = txs.slice(firstIndex,lastIndex+1).map((tx) => {
      return (
        <Tx
          darkMode={this.props.darkMode}
          key={tx.tx_hash}
          event_id={this.props.event_id}
          tx={tx}
          details={false}
          getData={this.props.getData}
          refreshData={this.props.refreshData}
          addTxFee={this.addTxFee}
        />
      );
    });

    let actualNumItemsPage = txs_jsx.length;

    let total_fees = this.state.txFees.reduce((sum, fees) => {
      return sum + fees;
    }, 0);

    return (
      <div style={blockStyles.main}>
        <div style={blockStyles.title}>
          <h3>Block</h3>
          <h3 style={blockStyles.titleText}>{block_hash}</h3>
          {
              block_height == 0
                ?
                  (
                     <div style={blockStyles.buttonsRowNext}>
                       <div>
                         <button style={blockStyles.button} onClick={this.handleNextBlock}>Next Block</button>
                       </div>
                     </div>
                  )
                :
                  (
                    <div style={blockStyles.buttonsRow}>
                      <div>
                        <button style={blockStyles.button} onClick={this.handlePreviousBlock}>Previous Block</button>
                      </div>
                      <div>
                        <button style={blockStyles.button} onClick={this.handleNextBlock}>Next Block</button>
                      </div>
                    </div>
                  )
          }
        </div>
        <div style={blockStyles.upper}>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Height</p>
            <p style={blockStyles.itemEnd}>{block_height}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Timestamp</p>
            <p style={blockStyles.itemEnd}>{new Date(timestamp * 1000).toUTCString()}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Size</p>
            <p style={blockStyles.itemEnd}>{(size / 1024).toFixed(3)} Kbytes</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Transactions</p>
            <p style={blockStyles.itemEnd}>{txs.length}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Block Reward</p>
            <p style={blockStyles.itemEnd}>{block_reward / 100000000} BTC</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Version</p>
            <p style={blockStyles.itemEnd}>{version}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Merkle Root</p>
            <p style={blockStyles.itemEnd}>{merkle_root}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Bits</p>
            <p style={blockStyles.itemEnd}>{bits}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Nonce</p>
            <p style={blockStyles.itemEnd}>{nonce}</p>
          </div>
          <div style={blockStyles.upperRow}>
            <p style={blockStyles.itemStart}>Total Fees</p>
            <p style={blockStyles.itemEnd}>{(total_fees/100000000).toFixed(8)} BTC</p>
          </div>
        </div>
        <div>
          <div style={blockStyles.navRow}>
            <div style={blockStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === 0 ? true : false}
                style={blockStyles.button}
                onClick={this.handlePreviousPage}
              >
                Previous Page
              </button>
            </div>
            <div style={blockStyles.navItem}>
              <p
                style={blockStyles.navText}
              >
                Transactions {firstIndex+1}-{firstIndex+actualNumItemsPage} out of {txs.length}{" "}
                {
                  this.state.showMore
                    ?
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show Less)</a>
                      )
                    :
                      txs.length > SHOWLESSITEMS &&
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show More)</a>
                      )
                }
              </p>
            </div>
            <div style={blockStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === totalPages - 1 ? true : false}
                style={blockStyles.button}
                onClick={this.handleNextPage}
              >
                Next Page
              </button>
            </div>
          </div>
          {txs_jsx}
          <div style={blockStyles.navRow}>
            <div style={blockStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === 0 ? true : false}
                style={blockStyles.button}
                onClick={this.handlePreviousPage}
              >
                Previous Page
              </button>
            </div>
            <div style={blockStyles.navItem}>
              <p
                style={blockStyles.navText}
              >
                Transactions {firstIndex+1}-{firstIndex+actualNumItemsPage} out of {txs.length}{" "}
                {
                  this.state.showMore
                    ?
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show Less)</a>
                      )
                    :
                      txs.length > SHOWLESSITEMS &&
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show More)</a>
                      )
                }
              </p>
            </div>
            <div style={blockStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === totalPages - 1 ? true : false}
                style={blockStyles.button}
                onClick={this.handleNextPage}
              >
                Next Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  componentDidUpdate() {

    let txinAmountsFinished = (txs) => {
      if (Array.isArray(txs) && txs.length > 0) {
        for (let i in txs) {
          for (let j in txs[i].tx_ins) {
            if (!isCoinbase(txs[i].tx_ins[j])) {
              if (txs[i].tx_ins[j].amount !== undefined) {
                continue;
              }
              return false;
            }
            continue;
          }
        }
        return true;
      }
      return false;
    };

    let txinAmountFinished = (txs) => {
      return (txinIdentifier) => {
        let {tx_hash, prev_tx, prev_index} = txinIdentifier;
        let match = false;
        txs.forEach((tx) => {
          if (tx.tx_hash === tx_hash) {
            tx.tx_ins.forEach((tx_in) => {
              if (
                tx_in.prev_tx === prev_tx &&
                tx_in.prev_index === prev_index &&
                tx_in.amount !== undefined
              ) {
                match = true;
              }
            });
          }
        });
        return match;
      };
    };

    if (this.state.txinAmountsStatus.split("in-progress-batches-")[0] === "") {
      if (txinAmountsFinished(this.props.block.txs)) {
        console.log("txinAmountsStatus: completed");
        this.setState({txinAmountsStatus: "completed"});
      }
      else {
        let startNumBatch = Number(this.state.txinAmountsStatus.split("in-progress-batches-")[1].split("-")[0]);
        let endNumBatch = Number(this.state.txinAmountsStatus.split("in-progress-batches-")[1].split("-")[1]);
        let current_batches = this.state.txinAmountsBatches.slice(startNumBatch, endNumBatch + 1);
        let batches_finished = current_batches.every((batch) => {
          return batch.every(txinAmountFinished(this.props.block.txs))
        });
        if (batches_finished) {
          let chunkBatch = this.state.chunkBatch;
          let next_batches = this.state.txinAmountsBatches.slice(endNumBatch + 1, endNumBatch + 1 + chunkBatch);

          let next_batches_tx_hashes = next_batches.map((batch) => {
            return batch.map((txinIdentifier) => {
              return txinIdentifier.prev_tx;
            });
          });

          next_batches_tx_hashes.forEach((batch) => {
            this.props.refreshData(
              this.props.event_id,
              batch,
              "txinAmountStream"
            );
          });

          let lastIndex = this.state.txinAmountsBatches.length - 1;
          let endIndex;
          if ((endNumBatch + 1 + (chunkBatch - 1)) > lastIndex) {
            endIndex = lastIndex;
          }
          else {
            endIndex = endNumBatch + 1 + (chunkBatch - 1);
          }
          console.log(
            "txinAmountsStatus: in-progress-batches-" +
            String(endNumBatch + 1) +
            "-" +
            String(endIndex)
          );
          this.setState({
            txinAmountsStatus: "in-progress-batches-" +
              String(endNumBatch + 1) +
              "-" +
              String(endIndex)
          });
        }
      }
    }
  }

  componentDidMount() {
    let tx_in_txs = [];

    this.props.block.txs.forEach((tx) => {
      tx.tx_ins.forEach((tx_in) => {
        if (!isCoinbase(tx_in)) {
          tx_in_txs.push({
            "tx_hash": tx.tx_hash,
            "prev_tx": tx_in.prev_tx,
            "prev_index": tx_in.prev_index
          });
        }
      });
    });

    let chunkItem = this.state.chunkItem;
    let tx_in_batches = [];

    for (let i = 0; i < tx_in_txs.length; i+=chunkItem) {
      let tx_in_batch = tx_in_txs.slice(i, i+chunkItem);
      tx_in_batches.push(tx_in_batch);
    }

    let chunkBatch = this.state.chunkBatch;
    let tx_in_batches_0 = tx_in_batches.slice(0, chunkBatch);
    let tx_in_tx_hashes_batches_0 = tx_in_batches_0.map((batch) => {
      return batch.map((txinIdentifier) => {
        return txinIdentifier.prev_tx;
      });
    });

    tx_in_tx_hashes_batches_0.forEach((batch) => {
      this.props.refreshData(
        this.props.event_id,
        batch,
        "txinAmountStream"
      );
    });

    let lastIndex = tx_in_batches.length - 1;
    let endIndex;
    if (chunkBatch - 1 > lastIndex) {
      endIndex = lastIndex;
    }
    else {
      endIndex = chunkBatch - 1;
    }
    console.log("txinAmountsBatches: " + tx_in_batches.length);
    console.log("items in each batch: " + this.state.chunkItem);
    console.log("txinAmountsStatus: in-progress-batches-0-" + String(endIndex));
    this.setState({
      txinAmountsStatus: "in-progress-batches-0-" + String(endIndex),
      txinAmountsBatches: tx_in_batches
    });
  }
}
