const txoutStyles = {
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
    },
    textLink: {
      cursor: "pointer",
      textDecoration: "underline"
    },
};

const OP_CODES = {
  0xac: "OP_CHECKSIG",
  0x76: "OP_DUP",
  0xa9: "OP_HASH160",
  0x87: "OP_EQUAL",
  0x88: "OP_EQUALVERIFY",
};

const isP2PK = (cmds) => {
  return  cmds.length === 2 &&
    typeof cmds[0] === "string" &&
    (cmds[0].length === 130 || cmds[0].length === 66) &&
    typeof cmds[1] === "number" &&
    cmds[1] === 0xac;
};

const isP2PKH = (cmds) => {
  return cmds.length === 5 &&
    typeof cmds[0] === "number" &&
    cmds[0] ===  0x76 &&
    typeof cmds[1] === "number" &&
    cmds[1] === 0xa9 &&
    typeof cmds[2] === "string" &&
    cmds[2].length == 40 &&
    typeof cmds[3] === "number" &&
    cmds[3] === 0x88 &&
    typeof cmds[4] === "number" &&
    cmds[4] === 0xac;
};

const isP2SH = (cmds) => {
  return cmds.length === 3 &&
    typeof cmds[0] === "number" &&
    cmds[0] === 0xa9 &&
    typeof cmds[1] === "string" &&
    cmds[1].length === 40 &&
    typeof cmds[2] === "number" &&
    cmds[2] === 0x87;
};

const isP2WPKH = (cmds) => {
  return cmds.length === 2 &&
    typeof cmds[0] === "number" &&
    cmds[0] === 0x00 &&
    typeof cmds[1] === "string" &&
    cmds[1].length === 40;
};

const isP2WSH = (cmds) => {
  return cmds.length === 2 &&
    typeof cmds[0] === "number" &&
    cmds[0] === 0x00 &&
    typeof cmds[1] === "string" &&
    cmds[1].length === 64;
};

const getScriptPubkeyType = (script_pubkey) => {
  cmds = script_pubkey.cmds;
  switch(true) {
    case isP2PK(cmds) === true:
      return "P2PK";
      break;
    case isP2PKH(cmds) === true:
      return "P2PKH";
      break;
    case isP2SH(cmds) === true:
      return "P2SH";
      break;
    case isP2WPKH(cmds) === true:
      return "P2WPKH";
      break;
    case isP2WSH(cmds) === true:
      return "P2WSH";
      break;
    default:
      return "UNKNOWN";
  }
};

const parseScriptPubkeyCmds = (script_pubkey) => {
  cmds = script_pubkey.cmds;
  return cmds.map((cmd) => {
    if (typeof cmd === "number") {
      if (OP_CODES[cmd] !== undefined) {
        return OP_CODES[cmd];
      }
      else {
        return "OPCODE: 0x" + cmd.toString(16);
      }
    }
    else {
      return cmd + ` [${cmd.length / 2} Bytes]`;
    }
  });
};

const toBech32 = (data, version, prefix) => {
  const words = bech32.toWords(data);
  words.unshift(version);
  return bech32.encode(prefix, words);
};

const getAddress = (script_pubkey) => {
  cmds = script_pubkey.cmds;
  switch(true) {
    case isP2PK(cmds) === true:
      var address_cmd = script_pubkey.cmds[0];
      return address_cmd.split(" ")[0];
      break;
    case isP2PKH(cmds) === true:
      var address_cmd = script_pubkey.cmds[2];
      return base58check.encode(address_cmd, "00");
      break;
    case isP2SH(cmds) === true:
      var address_cmd = script_pubkey.cmds[1];
      return base58check.encode(address_cmd, "05");
      break;
    case isP2WPKH(cmds) === true || isP2WSH(cmds) === true:
      var address_cmd = script_pubkey.cmds[1];
      var data = Buffer.from(address_cmd, "hex");
      return toBech32(data, 0, "bc");
      break;
    default:
      return null;
  }
};

class Tx_Out extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      refreshUtxoStatus: false
    };
    this.handleGetAddress = this.handleGetAddress.bind(this);
  }

  handleGetAddress(address) {
    this.props.getData(address);
  }

  render() {
    let {
      script_pubkey,
      amount,
      utxoStatus
    } = this.props.tx_out;
    let script_pubkey_hex = script_pubkey.cmds.join("");
    let script_pubkey_type = getScriptPubkeyType(script_pubkey);
    let address = getAddress(script_pubkey);
    let parse_script_pubkey_cmds = parseScriptPubkeyCmds(script_pubkey);
    let parse_script_pubkey_cmds_jsx = parse_script_pubkey_cmds.map(
      (cmd, index) =>
        <p
          key={index}
          style={txoutStyles.detailsItemText}
        >
          {cmd}
        </p>
    );
    return (
      <div style={this.props.darkMode ? Object.assign({}, txoutStyles.main, txoutStyles.mainDark) : txoutStyles.main}>
        <div style={txoutStyles.title}>
          <p style={txoutStyles.titleItemLeft}>
            #{this.props.index + " "}
            <a
              style={txoutStyles.textLink}
              onClick={() => this.handleGetAddress(address)}
            >
              {address}
            </a>
          </p>
          <p style={txoutStyles.titleItemRight}>{(amount/100000000).toFixed(8) + " BTC"}</p>
        </div>
        {
          this.props.details
            ?
              (
                <div style={txoutStyles.details}>
                  <div style={txoutStyles.detailsItem}>
                    <div style={txoutStyles.detailsItemLeft}>
                      <p style={txoutStyles.detailsItemText}>Type</p>
                    </div>
                    <div style={txoutStyles.detailsItemRight}>
                      <p style={txoutStyles.detailsItemText}>{script_pubkey_type}</p>
                    </div>
                  </div>
                  <div style={txoutStyles.detailsItem}>
                    <div style={txoutStyles.detailsItemLeft}>
                      <p style={txoutStyles.detailsItemText}>ScriptPubKey(CMDs)</p>
                    </div>
                    <div style={txoutStyles.detailsItemRight}>
                      {parse_script_pubkey_cmds_jsx}
                    </div>
                  </div>
                  <div style={txoutStyles.detailsItem}>
                    <div style={txoutStyles.detailsItemLeft}>
                      <p style={txoutStyles.detailsItemText}>ScriptPubKey(HEX)</p>
                    </div>
                    <div style={txoutStyles.detailsItemRight}>
                      <p style={txoutStyles.detailsItemText}>{script_pubkey_hex}</p>
                    </div>
                  </div>
                  {
                    utxoStatus === undefined ? null :
                     (
                       <Tx_Out_Utxo_Status
                         utxoStatus={utxoStatus}
                         getData={this.props.getData}
                       />
                     )
                  }
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
      ["Block", "Home", "Address"].includes(this.props.queryType) &&
      !this.state.refreshUtxoStatus
    ) {
      if (this.props.tx_out.utxoStatus === undefined) {
        this.props.refreshData(
          this.props.event_id,
          {
            tx_hash: this.props.tx_hash,
            tx_index: this.props.index
          },
          "utxoStatus"
        );
        this.setState({refreshUtxoStatus: true});
      }
    }
  }
}
