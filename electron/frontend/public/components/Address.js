const addressStyles = {
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
  txTypeRow: {
    padding: "5px",
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  txTypeItem: {
    margin: "10px"
  },
};

class Address extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      numItemsPage: 10,
      currentPageIndex: 0,
      chunkItemTx: 10,
      chunkItem: 2,
      chunkBatch: 10,
      txinAmountsStatus: null,
      txinAmountsBatches: [],
      utxoStatus: null,
      utxoBatches: [],
      spentTxStatus: null,
      spentTxBatches: [],
      spentTxinAmountsStatus: null,
      spentTxinAmountsBatches: [],
      showMore: false,
      showReceivedTxs: true,
      showSpentTxs: false,
      showAllTxs: false
    };
    this.handlePreviousPage = this.handlePreviousPage.bind(this);
    this.handleNextPage = this.handleNextPage.bind(this);
    this.toggleShowMore = this.toggleShowMore.bind(this);
    this.displayReceivedTxs = this.displayReceivedTxs.bind(this);
    this.displaySpentTxs = this.displaySpentTxs.bind(this);
    this.displayAllTxs = this.displayAllTxs.bind(this);
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

  handleNextPage(num_txs) {
    let totalPages = Math.ceil(
      num_txs / this.state.numItemsPage
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
          numItemsPage: 10,
          currentPageIndex: 0,
          showMore: false
        };
      }
      else {
        return {
          numItemsPage: 50,
          currentPageIndex: 0,
          showMore: true
        };
      }
    });
  }

  displayReceivedTxs() {
    this.setState({
      showReceivedTxs: true,
      showSpentTxs: false,
      showAllTxs: false,
      currentPageIndex: 0
    });
  }

  displaySpentTxs() {
    this.setState({
      showReceivedTxs: false,
      showSpentTxs: true,
      showAllTxs: false,
      currentPageIndex: 0
    });
  }

  displayAllTxs() {
    this.setState({
      showReceivedTxs: false,
      showSpentTxs: false,
      showAllTxs: true,
      currentPageIndex: 0
    });
  }

  render() {

    const sort_txs = (txs) => {
      if (txs.length > 1) {
        return txs.sort((a, b) => {
          return a.block_height - b.block_height;
        });
      }
      else {
        return items;
      }
    };

    let {
      address_b58,
      address_raw,
      total_balance,
      utxos,
      txs,
      txs_spent
    } = this.props.address;

    let {
      numItemsPage,
      currentPageIndex
    } = this.state;

    txs = sort_txs(txs);
    let txs_all = [];

    let totalPages = 1;
    let txs_length = 0;
    let txs_jsx = [];
    let handleNextPageButton = null;
    let firstIndex = currentPageIndex * numItemsPage;
    let lastIndex =  firstIndex + (numItemsPage - 1);

    if (this.state.showReceivedTxs) {
      totalPages = Math.ceil(
        txs.length / this.state.numItemsPage
      );
      txs_jsx = txs.slice(firstIndex,lastIndex+1).map((tx) => {
        return (
          <Tx
            key={tx.tx_hash}
            darkMode={this.props.darkMode}
            event_id={this.props.event_id}
            tx={tx}
            details={false}
            getData={this.props.getData}
            refreshData={this.props.refreshData}
          />
        );
      });
      txs_length = txs.length;
      handleNextPageButton = () => this.handleNextPage(txs_length);
    }

    if (this.state.showSpentTxs) {
      if (txs_spent !== undefined) {
        if (Array.isArray(txs_spent) && txs_spent.length > 0) {
          totalPages = Math.ceil(
            txs_spent.length / this.state.numItemsPage
          );

          txs_spent = sort_txs(txs_spent);

          txs_jsx = txs_spent.slice(firstIndex,lastIndex+1).map((tx) => {
            return (
              <Tx
                key={tx.tx_hash}
                darkMode={this.props.darkMode}
                event_id={this.props.event_id}
                tx={tx}
                details={false}
                getData={this.props.getData}
                refreshData={this.props.refreshData}
              />
            );
          });
          txs_length = txs_spent.length;
          handleNextPageButton = () => this.handleNextPage(txs_length);
        }
      }
    }

    if (this.state.showAllTxs) {
      txs_all = sort_txs(txs);
      if (txs_spent !== undefined) {
        if (Array.isArray(txs_spent) && txs_spent.length > 0) {
          txs_spent = sort_txs(txs_spent);
          txs_all = sort_txs([...txs_all, ...txs_spent]);
        }
      }
      totalPages = Math.ceil(
        txs_all.length / this.state.numItemsPage
      );
      txs_jsx = txs_all.slice(firstIndex,lastIndex+1).map((tx) => {
        return (
          <Tx
            key={tx.tx_hash}
            darkMode={this.props.darkMode}
            event_id={this.props.event_id}
            tx={tx}
            details={false}
            getData={this.props.getData}
            refreshData={this.props.refreshData}
          />
        );
      });
      txs_length = txs_all.length;
      handleNextPageButton = () => this.handleNextPage(txs_length);
    }

    let spent_txs_tab_jsx = null;
    if (txs_spent !== undefined) {
      if (Array.isArray(txs_spent) && txs_spent.length > 0) {
        spent_txs_tab_jsx = (
          <div style={addressStyles.txTypeItem}>
            <p>
              <a
                style={
                  this.state.showSpentTxs
                    ? Object.assign({}, addressStyles.itemTextLink, {fontWeight: "bold"})
                    : addressStyles.itemTextLink
                  }
                onClick={this.displaySpentTxs}
              >
                Spent Txs
              </a>
            </p>
          </div>
        );
      }
    }

    let actualNumItemsPage = txs_jsx.length;

    let spent_balance = 0;
    let num_spent_txs = 0
    utxos.forEach((utxo, index) => {
      let {tx_hash, tx_index} = utxo;
      let tx_match = txs.filter((tx) => {
        return tx.tx_hash === tx_hash;
      });
      if (tx_match.length === 1) {
        let tx_out = tx_match[0].tx_outs[tx_index];
        if (tx_out.utxoStatus !== undefined) {
          if (tx_out.utxoStatus.spent) {
            spent_balance += tx_out.amount;
            num_spent_txs += 1;
          }
        }
      }
    });

    return (
      <div style={addressStyles.main}>
        <div style={addressStyles.title}>
          <h3>Address</h3>
          <h3 style={addressStyles.titleText}>{address_b58}</h3>
        </div>
        <div style={addressStyles.upper}>
          <div style={addressStyles.upperRow}>
            <p style={addressStyles.itemStart}>Confirmed Tx Count</p>
            <p style={addressStyles.itemEnd}>
              {txs.length + num_spent_txs}
            </p>
          </div>
          <div style={addressStyles.upperRow}>
            <p style={addressStyles.itemStart}>Confirmed Received</p>
            <p style={addressStyles.itemEnd}>{txs.length} txs ({(total_balance/100000000).toFixed(8)} BTC)</p>
          </div>
          <div style={addressStyles.upperRow}>
            <p style={addressStyles.itemStart}>Confirmed Spent</p>
            <p style={addressStyles.itemEnd}>
              {num_spent_txs} txs ({(spent_balance/100000000).toFixed(8)} BTC)
            </p>
          </div>
          <div style={addressStyles.upperRow}>
            <p style={addressStyles.itemStart}>Balance Pending</p>
            <p style={addressStyles.itemEnd}>{((total_balance - spent_balance)/100000000).toFixed(8)} BTC</p>
          </div>
        </div>
        <div>
          <div style={addressStyles.navRow}>
            <div style={addressStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === 0 ? true : false}
                style={addressStyles.button}
                onClick={this.handlePreviousPage}
              >
                Previous Page
              </button>
            </div>
            <div style={addressStyles.navItem}>
              <p
                style={addressStyles.navText}
              >
                Transactions {firstIndex+1}-{firstIndex+actualNumItemsPage} out of {txs_length}{" "}
                {
                  this.state.showMore
                    ?
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show Less)</a>
                      )
                    :
                      txs_length > SHOWLESSITEMS &&
                      (
                        <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show More)</a>
                      )
                }
              </p>
            </div>
            <div style={addressStyles.navItem}>
              <button
                disabled={totalPages === 1 || currentPageIndex === totalPages - 1 ? true : false}
                style={addressStyles.button}
                onClick={handleNextPageButton}
              >
               Next Page
              </button>
            </div>
          </div>
        </div>
        <div style={addressStyles.txTypeRow}>
          <div style={addressStyles.txTypeItem}>
            <p>
              <a
                style={
                  this.state.showReceivedTxs
                    ? Object.assign({}, addressStyles.itemTextLink, {fontWeight: "bold"})
                    : addressStyles.itemTextLink
                  }
                onClick={this.displayReceivedTxs}
              >
                Received Txs
              </a></p>
          </div>
          {spent_txs_tab_jsx}
          <div style={addressStyles.txTypeItem}>
            <p>
              <a
                style={
                  this.state.showAllTxs
                    ? Object.assign({}, addressStyles.itemTextLink, {fontWeight: "bold"})
                    : addressStyles.itemTextLink
                  }
                onClick={this.displayAllTxs}
              >
                All Txs
              </a></p>
          </div>
        </div>
        {txs_jsx.length > 0 && txs_jsx}
        <div style={addressStyles.navRow}>
          <div style={addressStyles.navItem}>
            <button
              disabled={totalPages === 1 || currentPageIndex === 0 ? true : false}
              style={addressStyles.button}
              onClick={this.handlePreviousPage}
            >
              Previous Page
            </button>
          </div>
          <div style={addressStyles.navItem}>
            <p
              style={addressStyles.navText}
            >
              Transactions {firstIndex+1}-{firstIndex+actualNumItemsPage} out of {txs_length}{" "}
              {
                this.state.showMore
                  ?
                    (
                      <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show Less)</a>
                    )
                  :
                    txs_length > SHOWLESSITEMS &&
                    (
                      <a style={blockStyles.itemTextLink} onClick={this.toggleShowMore}>(Show More)</a>
                    )
              }
            </p>
          </div>
          <div style={addressStyles.navItem}>
            <button
              disabled={totalPages === 1 || currentPageIndex === totalPages - 1 ? true : false}
              style={addressStyles.button}
              onClick={handleNextPageButton}
            >
             Next Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  componentDidUpdate() {

    let address_b58 = this.props.address.address_b58;

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

    let utxoStatusesFinished = () => {
      let {utxos, txs} = this.props.address;
      for (let i in utxos) {
        let {tx_hash, tx_index} = utxos[i];
        let tx_match = txs.filter((tx) => {
          return tx.tx_hash === tx_hash;
        });
        if (tx_match.length === 1) {
          let tx_out = tx_match[0].tx_outs[tx_index];
          if (tx_out.utxoStatus === undefined) {
            return false;
          }
        }
      }
      return true;
    };

    let utxoStatusFinished = (txs) => {
      return (utxo) => {
        let match = false;
        let {tx_hash, tx_index} = utxo;
        txs.forEach((tx) => {
          if (tx.tx_hash === tx_hash) {
            let tx_out = tx.tx_outs[tx_index];
            if (tx_out.utxoStatus !== undefined) {
              match = true;
            }
          }
        });
        return match;
      }
    };

    let txIncluded = (txs) => {
      return (tx_hash) => {
        let match = false;
        txs.forEach((tx) => {
          if (tx.tx_hash === tx_hash) {
            match = true;
          }
        });
        return match;
      }
    };

    let txsValid = (txs) => {
      return txs !== undefined &&
        Array.isArray(txs) &&
        txs.length > 0;
    };

    if (this.state.txinAmountsStatus.split("in-progress-batches-")[0] === "") {
      if (txinAmountsFinished(this.props.address.txs)) {
        console.log("txinAmountsStatus: completed");
        this.setState({txinAmountsStatus: "completed"});
      }
      else {
        let startNumBatch = Number(this.state.txinAmountsStatus.split("in-progress-batches-")[1].split("-")[0]);
        let endNumBatch = Number(this.state.txinAmountsStatus.split("in-progress-batches-")[1].split("-")[1]);
        let current_batches = this.state.txinAmountsBatches.slice(startNumBatch, endNumBatch + 1);
        let batches_finished = current_batches.every((batch) => {
          return batch.every(txinAmountFinished(this.props.address.txs))
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

    if (this.state.utxoStatus.split("in-progress-batches-")[0] === "") {
      if (utxoStatusesFinished()) {
        console.log("utxoStatus: completed");
        this.setState({utxoStatus: "completed"});
      }
      else {
        let startNumBatch = Number(this.state.utxoStatus.split("in-progress-batches-")[1].split("-")[0]);
        let endNumBatch = Number(this.state.utxoStatus.split("in-progress-batches-")[1].split("-")[1]);
        let current_batches = this.state.utxoBatches.slice(startNumBatch, endNumBatch + 1);
        let batches_finished = current_batches.every((batch) => {
          return batch.every(utxoStatusFinished(this.props.address.txs))
        });

        if (batches_finished) {

          let chunkBatch = this.state.chunkBatch;
          let next_batches = this.state.utxoBatches.slice(
            endNumBatch + 1,
            endNumBatch + 1 + chunkBatch
          );

          next_batches.forEach((batch) => {
            this.props.refreshData(
              this.props.event_id,
              batch,
              "utxoStatusStream"
            );
          });

          let lastIndex = this.state.utxoBatches.length - 1;
          let endIndex;
          if ((endNumBatch + 1 + (chunkBatch - 1)) > lastIndex) {
            endIndex = lastIndex;
          }
          else {
            endIndex = endNumBatch + 1 + (chunkBatch - 1);
          }
          console.log(
            "utxoStatus: in-progress-batches-" +
            String(endNumBatch + 1) +
            "-" +
            String(endIndex)
          );
          this.setState({
            utxoStatus: "in-progress-batches-" +
              String(endNumBatch + 1) +
              "-" +
              String(endIndex)
          });
        }
      }
    }

    if (
      this.state.utxoStatus === "completed" &&
      (this.state.spentTxStatus === null ||
      this.state.spentTxStatus.split("in-progress-batch-")[0] === "")
    ) {
      if (this.state.spentTxStatus === null) {
        let spentTx = [];

        this.props.address.txs.forEach((tx) => {
          tx.tx_outs.forEach((tx_out) => {
            let {
              script_pubkey,
              utxoStatus
            } = tx_out;
            let tx_out_address_b58 = getAddress(script_pubkey);
            if (
              tx_out_address_b58 === address_b58 &&
              utxoStatus !== undefined &&
              utxoStatus.spent
            ) {
              if (!spentTx.includes(utxoStatus.spending_tx_hash)) {
                spentTx.push(utxoStatus.spending_tx_hash);
              }
            }
          });
        });

        if (spentTx.length === 0) {
          console.log("spentTxStatus: completed");
          this.setState({spentTxStatus: "completed"});
        }
        else {
          let chunkItem = this.state.chunkItemTx;
          let spentTxBatches = [];
          for (let i = 0; i < spentTx.length; i+=chunkItem) {
            let spentTxBatch = spentTx.slice(i, i+chunkItem);
            spentTxBatches.push(spentTxBatch);
          }

          let spentTxBatch_0 = spentTxBatches[0];
          spentTxBatch_0.forEach((tx_hash) => {
            this.props.refreshData(
              this.props.event_id,
              tx_hash,
              "addressSpentTx"
            );
          });
          console.log("spentTxBatches: " + spentTxBatches.length);
          console.log("items in each batch: " + this.state.chunkItemTx);
          console.log("spentTxStatus: in-progress-batch-0");
          this.setState({
            spentTxStatus: "in-progress-batch-0",
            spentTxBatches: spentTxBatches
          });
        }
      }
      else {
        let finished = txsValid(this.props.address.txs_spent) &&
          this.state.spentTxBatches.every((batch) => {
              return batch.every(txIncluded(this.props.address.txs_spent));
          });

        if (finished) {
          console.log("spentTxStatus: completed");
          this.setState({spentTxStatus: "completed"});
        }
        else {
          let numBatch = Number(this.state.spentTxStatus.split("in-progress-batch-")[1]);
          let currentBatch = this.state.spentTxBatches[numBatch];
          if (txsValid(this.props.address.txs_spent)) {
            let batch_finished = currentBatch.every(txIncluded(this.props.address.txs_spent));
            if (batch_finished) {
              let lastIndex = this.state.spentTxBatches.length - 1;
              if (numBatch + 1 <= lastIndex) {
                let next_batch = this.state.spentTxBatches[numBatch + 1];
                next_batch.forEach((tx_hash) => {
                  this.props.refreshData(
                    this.props.event_id,
                    tx_hash,
                    "addressSpentTx"
                  );
                });
                console.log("spentTxStatus: in-progress-batch-" + String(numBatch + 1));
                this.setState({spentTxStatus: "in-progress-batch-" + String(numBatch + 1)});
              }
            }
          }
        }
      }
    }

    if (
      this.state.spentTxStatus === "completed" &&
      (this.state.spentTxinAmountsStatus === null ||
      this.state.spentTxinAmountsStatus.split("in-progress-batches-")[0] === "")
    ) {
      if (this.state.spentTxinAmountsStatus === null) {
        if (txsValid(this.props.address.txs_spent)) {
          let tx_in_txs = [];

          this.props.address.txs_spent.forEach((tx) => {
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
          console.log("spentTxinAmountsBatches: " + tx_in_batches.length);
          console.log("items in each batch: " + this.state.chunkItem);
          console.log("spentTxinAmountsStatus: in-progress-batches-0-" + String(endIndex));
          this.setState({
            spentTxinAmountsStatus: "in-progress-batches-0-" + String(endIndex),
            spentTxinAmountsBatches: tx_in_batches
          });
        }
        else {
          console.log("spentTxinAmountsStatus: completed");
          this.setState({spentTxinAmountsStatus: "completed"});
        }
      }
      else {
        if (txinAmountsFinished(this.props.address.txs_spent)) {
          console.log("spentTxinAmountsStatus: completed");
          this.setState({spentTxinAmountsStatus: "completed"});
        }
        else {
          let startNumBatch = Number(this.state.spentTxinAmountsStatus.split("in-progress-batches-")[1].split("-")[0]);
          let endNumBatch = Number(this.state.spentTxinAmountsStatus.split("in-progress-batches-")[1].split("-")[1]);
          let current_batches = this.state.spentTxinAmountsBatches.slice(startNumBatch, endNumBatch + 1);
          let batches_finished = current_batches.every((batch) => {
            return batch.every(txinAmountFinished(this.props.address.txs_spent))
          });
          if (batches_finished) {
            let chunkBatch = this.state.chunkBatch;
            let next_batches = this.state.spentTxinAmountsBatches.slice(endNumBatch + 1, endNumBatch + 1 + chunkBatch);

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

            let lastIndex = this.state.spentTxinAmountsBatches.length - 1;
            let endIndex;
            if ((endNumBatch + 1 + (chunkBatch - 1)) > lastIndex) {
              endIndex = lastIndex;
            }
            else {
              endIndex = endNumBatch + 1 + (chunkBatch - 1);
            }
            console.log(
              "spentTxinAmountsStatus: in-progress-batches-" +
              String(endNumBatch + 1) +
              "-" +
              String(endIndex)
            );
            this.setState({
              spentTxinAmountsStatus: "in-progress-batches-" +
                String(endNumBatch + 1) +
                "-" +
                String(endIndex)
            });
          }
        }
      }
    }
  }

  componentDidMount() {

    let address_b58 = this.props.address.address_b58;

    let startUtxoStatus = () => {
      let chunkItem = this.state.chunkItem;
      let chunkBatch = this.state.chunkBatch;

      let addressUtxos = [];
      let addressUtxosBatches = [];

      this.props.address.txs.forEach((tx) => {
        tx.tx_outs.forEach((tx_out, index) => {
          let tx_out_address_b58 = getAddress(tx_out.script_pubkey);
          if (tx_out_address_b58 === address_b58) {
            addressUtxos.push({
              tx_hash: tx.tx_hash,
              tx_index: index
            });
          }
        })
      });

      for (let i = 0; i < addressUtxos.length; i+=chunkItem) {
        let addressUtxosBatch = addressUtxos.slice(i, i+chunkItem);
        addressUtxosBatches.push(addressUtxosBatch);
      }


      let addressUtxosBatches_0 = addressUtxosBatches.slice(0, chunkBatch);
      addressUtxosBatches_0.forEach((batch) => {
        this.props.refreshData(
          this.props.event_id,
          batch,
          "utxoStatusStream"
        );
      });

      let lastIndex = addressUtxosBatches.length - 1;
      let endIndex;
      if (chunkBatch - 1 > lastIndex) {
        endIndex = lastIndex;
      }
      else {
        endIndex = chunkBatch - 1;
      }
      console.log("utxoBatches: " + addressUtxosBatches.length);
      console.log("items in each batch: " + this.state.chunkItem);
      console.log("utxoStatus: in-progress-batches-0-" + String(endIndex));
      this.setState({
        utxoStatus: "in-progress-batches-0-" + String(endIndex),
        utxoBatches: addressUtxosBatches
      });
    }

    let startTxinAmounts = () => {
      let chunkItem = this.state.chunkItem;
      let chunkBatch = this.state.chunkBatch;
      let tx_in_txs = [];

      this.props.address.txs.forEach((tx) => {
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

      let tx_in_batches = [];

      for (let i = 0; i < tx_in_txs.length; i+=chunkItem) {
        let tx_in_batch = tx_in_txs.slice(i, i+chunkItem);
        tx_in_batches.push(tx_in_batch);
      }

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
    };

    startUtxoStatus();
    startTxinAmounts();

  }
}
