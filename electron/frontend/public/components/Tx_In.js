const txinStyles = {
    main: {
      width: "100%",
      fontSize: "x-small",
      margin: "5px",
      padding: "5px",
      borderStyle: "solid",
      borderRadius: "10px",
      borderWidth: "1px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F5F5F5"
    },
    mainDark: {
      backgroundColor: "#424242",
      color: "white"
    },
    title: {
      width: "100%",
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    titleItemLeft: {
      margin: "3px",
      width: "50%",
      textAlign: "left",
      wordBreak: "break-all",
    },
    titleItemRight: {
      margin: "3px",
      width: "50%",
      textAlign: "right",
      wordBreak: "break-all",
    },
    details: {
      width: "100%",
      paddingLeft: "5px",
      paddingRight: "5px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center"
    },
    detailsItem: {
      padding: "5px",
      width: "100%",
      textAlign: "left",
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start"
    },
    detailsItemLeft: {
      width: "35%",
      wordBreak: "break-all",
      marginRight: "2.5px"
    },
    detailsItemRight: {
      width: "65%",
      textAlign: "left",
      wordBreak: "break-all",
      fontWeight: "bold",
      marginLeft: "2.5px"
    },
    detailsItemText: {
      marginBottom: 0,
      marginTop: 0
    }
};

const bytesZeros = "0000000000000000000000000000000000000000000000000000000000000000";
const maxIndex = 4294967295;

const isCoinbase = (tx_in) => {
  let {
    prev_tx,
    prev_index,
    script_sig,
    sequence,
    amount
  } = tx_in;
  if (prev_tx === bytesZeros && prev_index === maxIndex) {
    return true;
  }
  return false;
};

const parseScriptSigCmds = (script_sig) => {
  cmds = script_sig.cmds;
  return cmds.map((cmd) => {
    if (typeof cmd === "number") {
      return "OPCODE: 0x" + cmd.toString(16);
    }
    else {
      return cmd + ` [${cmd.length / 2} Bytes]`;
    }
  });
};

class Tx_In extends React.Component {
  super(props) {
    constructor(props);
    this.state = {};
  }

  render() {
    let {
      prev_tx,
      prev_index,
      script_sig,
      sequence,
      amount
    } = this.props.tx_in;

    let title = "";
    if (isCoinbase(this.props.tx_in)) {
      title = "Coinbase";
    }
    else {
      title = prev_tx + ":" + prev_index;
    }
    let sequence_hex = sequence.toString(16);
    let script_sig_hex = script_sig.cmds.join("");

    let parse_script_sig_cmds = parseScriptSigCmds(script_sig);
    let parse_script_sig_cmds_jsx = parse_script_sig_cmds.map(
      (cmd, index) =>
        <p
          key={index}
          style={txinStyles.detailsItemText}
        >
          {cmd}
        </p>
    );

    return (
      <div style={this.props.darkMode ? Object.assign({}, txinStyles.main, txinStyles.mainDark) : txinStyles.main}>
        <div style={txinStyles.title}>
          <p style={txinStyles.titleItemLeft}>#{this.props.index + " " + title}</p>
          <p style={txinStyles.titleItemRight}>{amount !== undefined ? (amount/100000000).toFixed(8) + " BTC" : null}</p>
        </div>
        {
          this.props.details
            ?
              (
                <div style={txinStyles.details}>
                  <div style={txinStyles.detailsItem}>
                    <div style={txinStyles.detailsItemLeft}>
                      <p style={txinStyles.detailsItemText}>ScriptSig (CMDs)</p>
                    </div>
                    <div style={txinStyles.detailsItemRight}>
                      {parse_script_sig_cmds_jsx}
                    </div>
                  </div>
                  <div style={txinStyles.detailsItem}>
                    <div style={txinStyles.detailsItemLeft}>
                      <p style={txinStyles.detailsItemText}>ScriptSig (HEX)</p>
                    </div>
                    <div style={txinStyles.detailsItemRight}>
                      <p style={txinStyles.detailsItemText}>{script_sig_hex}</p>
                    </div>
                  </div>
                  <div style={txinStyles.detailsItem}>
                    <div style={txinStyles.detailsItemLeft}>
                      <p style={txinStyles.detailsItemText}>ScriptSig (HEX)</p>
                    </div>
                    <div style={txinStyles.detailsItemRight}>
                      <p style={txinStyles.detailsItemText}>{sequence_hex}</p>
                    </div>
                  </div>
                </div>
              )
            : null
        }
      </div>
    );
  }

  componentDidUpdate() {
    if (
      this.props.details &&
      ["Block", "Address"].includes(this.props.queryType) &&
      !isCoinbase(this.props.tx_in)
    ) {
      if (this.props.tx_in.amount === undefined) {
        this.props.refreshData(
          this.props.event_id,
          this.props.tx_in.prev_tx,
          "txinAmount"
        );
      }
    }
  }

  componentDidMount() {
    if (
      (
        ["Home"].includes(this.props.queryType) &&
        !isCoinbase(this.props.tx_in)
      )
    ) {
      if (this.props.tx_in.amount === undefined) {
        this.props.refreshData(
          this.props.event_id,
          this.props.tx_in.prev_tx,
          "txinAmount"
        );
      }
    }
  }
}
