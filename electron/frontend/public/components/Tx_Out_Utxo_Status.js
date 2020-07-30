const txoututxoStyles = {
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
    detailsItemTextLink: {
      cursor: "pointer",
      textDecoration: "underline"
    }
};

class Tx_Out_Utxo_Status extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    let {
      spent,
      spending_block_height,
      spending_block_hash,
      spending_tx_hash,
      spending_index
    } = this.props.utxoStatus;
    if (spent) {
      return (
        <div style={txoututxoStyles.detailsItem}>
          <div style={txoututxoStyles.detailsItemLeft}>
            <p style={txoututxoStyles.detailsItemText}>Spending TX</p>
          </div>
          <div style={txoututxoStyles.detailsItemRight}>
            <p style={txoututxoStyles.detailsItemText}>
              Spent by {" "}
              <a
                style={txoututxoStyles.detailsItemTextLink}
                onClick={() => this.props.getData(spending_tx_hash)}
              >
                {`${spending_tx_hash}:${spending_index}`}
              </a> in block #
                <a
                  style={txoututxoStyles.detailsItemTextLink}
                  onClick={() => this.props.getData(spending_block_height)}
                >
                  {`${spending_block_height}`}
                </a>
            </p>
          </div>
        </div>
      );
    }
    else {
      return (
        <div style={txoututxoStyles.detailsItem}>
          <div style={txoututxoStyles.detailsItemLeft}>
            <p style={txoututxoStyles.detailsItemText}>Spending TX</p>
          </div>
          <div style={txoututxoStyles.detailsItemRight}>
            <p style={txoututxoStyles.detailsItemText}>
              Unspent
            </p>
          </div>
        </div>
      );
    }
  }
}
