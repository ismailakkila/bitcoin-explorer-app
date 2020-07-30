const txStyles = {
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
    alignItems: "center"
  },
  titleText: {
    wordBreak: "break-all"
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
    justifyContent: "space-between"
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
  itemTextLink: {
    cursor: "pointer",
    textDecoration: "underline"
  },
  lower: {
    margin: "5px",
    padding: "5px",
    borderRadius: "10px",
    borderStyle: "solid",
    borderWidth: "1px",
    width: "85%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  lowerTitle: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  lowerTitleLeft: {
    margin: "3px",
    textAlign: "left",
    wordBreak: "break-all",
  },
  lowerInputsOutputs: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "10px"
  },
  detailsButton: {
    margin: "3px",
    fontFamily: "monospace"
  },
  detailsTxInOutBox: {
    width: "45%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsArrow: {
    fontWeight: "bold",
    alignSelf: "center"
  }
};

class Tx extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      details: false,
      fees: null
    };
    this.toggleDetails = this.toggleDetails.bind(this);
  }

  toggleDetails() {
    this.setState((state, props) => ({
      details: !state.details
    }));
  }

  render() {
    let {
      segwit,
      tx_hash,
      version,
      tx_ins,
      tx_outs,
      locktime,
      size,
      block_hash,
      block_height,
      timestamp
    } = this.props.tx;

    let tx_ins_jsx = tx_ins.map((tx_in, index) => {
      return (
        <Tx_In
          key={tx_in.prev_tx + tx_in.prev_index}
          darkMode={this.props.darkMode}
          index={index}
          event_id={this.props.event_id}
          queryType={this._reactInternalFiber._debugOwner.type.name}
          tx_in={tx_in}
          refreshData={this.props.refreshData}
          details={this.state.details}
        />
      );
    });
    let tx_outs_jsx = tx_outs.map((tx_out, index) => {
      return (
        <Tx_Out
          key={index}
          darkMode={this.props.darkMode}
          index={index}
          event_id={this.props.event_id}
          queryType={this._reactInternalFiber._debugOwner.type.name}
          tx_hash={tx_hash}
          tx_out={tx_out}
          getData={this.props.getData}
          refreshData={this.props.refreshData}
          details={this.state.details}
        />
      );
    });

    return (
      <div style={txStyles.main}>
        {
          this.props.details
            ?
              (
                <div>
                  <div style={txStyles.title}>
                    <h3>Transaction</h3>
                    <h3 style={txStyles.titleText}>{tx_hash}</h3>
                  </div>
                  <div style={txStyles.upper}>
                    {
                      block_hash !== undefined &&
                      block_height !== undefined &&
                      timestamp !== undefined &&
                        (
                          <div style={{width: "100%"}}>
                            <div style={txStyles.upperRow}>
                              <p style={txStyles.itemStart}>Included In Block</p>
                              <p style={txStyles.itemEnd}>
                                <a
                                  style={txStyles.itemTextLink}
                                  onClick={() => this.props.getData(block_hash)}
                                >
                                  {block_hash}
                                </a>
                              </p>
                            </div>
                            <div style={txStyles.upperRow}>
                              <p style={txStyles.itemStart}>Block Height</p>
                              <p style={txStyles.itemEnd}>{block_height}</p>
                            </div>
                            <div style={txStyles.upperRow}>
                              <p style={txStyles.itemStart}>Timestamp</p>
                              <p style={txStyles.itemEnd}>{new Date(timestamp * 1000).toUTCString()}</p>
                            </div>
                          </div>
                        )
                    }
                    <div style={txStyles.upperRow}>
                      <p style={txStyles.itemStart}>Segwit</p>
                      <p style={txStyles.itemEnd}>{segwit ? "Enabled" : "Disabled"}</p>
                    </div>
                    <div style={txStyles.upperRow}>
                      <p style={txStyles.itemStart}>Size</p>
                      <p style={txStyles.itemEnd}>{size} Bytes</p>
                    </div>
                    <div style={txStyles.upperRow}>
                      <p style={txStyles.itemStart}>Version</p>
                      <p style={txStyles.itemEnd}>{version}</p>
                    </div>
                    <div style={txStyles.upperRow}>
                      <p style={txStyles.itemStart}>Locktime</p>
                      <p style={txStyles.itemEnd}>{locktime}</p>
                    </div>
                    {
                      this.state.fees !== null && (
                        <div style={txStyles.upperRow}>
                          <p style={txStyles.itemStart}>Fees</p>
                          <p style={txStyles.itemEnd}>{this.state.fees} Sats</p>
                        </div>
                      )
                    }
                  </div>
                  <br />
                  <br />
                </div>
              )
            : null
        }
        <div style={txStyles.lower}>
          <div style={txStyles.lowerTitle}>
              <h4
                style={txStyles.lowerTitleLeft}
              >
                {this.props.details
                  ? tx_hash
                  : <a
                      style={txStyles.itemTextLink}
                      onClick={()=>this.props.getData(tx_hash)}
                    >
                      {tx_hash}
                    </a>}
              </h4>
              <div>
                <button
                  style={txStyles.detailsButton}
                  onClick={this.toggleDetails}
                >
                  {this.state.details ? "Less Details" : "Details"}
                </button>
              </div>
          </div>
          <div style={txStyles.lowerInputsOutputs}>
            <div style={txStyles.detailsTxInOutBox}>
              {tx_ins_jsx}
            </div>
            <div style={txStyles.detailsArrow}>
              <p>></p>
            </div>
            <div style={txStyles.detailsTxInOutBox}>
              {tx_outs_jsx}
            </div>
          </div>
        </div>
      </div>
    );
  }

  componentDidUpdate() {
    let {
      tx_ins,
      tx_outs
    } = this.props.tx;

    if (!isCoinbase(tx_ins[0]) && this.state.fees === null) {
      let tx_ins_completed = tx_ins.every((tx_in) => {
        return tx_in.amount !== undefined;
      });

      if (tx_ins_completed) {

        let tx_ins_sum = tx_ins.reduce((sum, tx_in) => {
          return sum + tx_in.amount;
        }, 0);

        let tx_outs_sum = tx_outs.reduce((sum, tx_out) => {
          return sum + tx_out.amount;
        }, 0);

        let fees = tx_ins_sum - tx_outs_sum;
        this.setState({
          fees: fees
        });
        if (this.props.addTxFee !== undefined) {
          this.props.addTxFee(fees);
        }
      }
    }
  }
}
