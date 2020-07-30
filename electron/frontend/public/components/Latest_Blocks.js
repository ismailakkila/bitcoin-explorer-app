const latestBlockStyles = {
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
  list: {
    borderTop: "1px solid",
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  item: {
    margin: "5px",
    flexBasis: "15%"
  },
  itemLarge: {
    margin: "5px",
    flexBasis: "30%"
  },
  itemTextLink: {
    cursor: "pointer",
    textDecoration: "underline"
  },
};

class Latest_Blocks extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  render() {
    let { err, latestBlocksParams } = this.props.blocks;
    let latest_blocks_jsx = null;
    let mined_btc = null
    if (err === null) {
      let { type, data } = latestBlocksParams;
      if (type === "block") {
        let latest_blocks = data;
        mined_btc = latest_blocks[0].mined_btc;
        latest_blocks_jsx = latest_blocks.map((block) => {
          return (
            <div style={latestBlockStyles.list} key={block.block_hash}>
              <p
                onClick={() => this.props.getData(block.block_height)}
                style={Object.assign({}, latestBlockStyles.item, latestBlockStyles.itemTextLink)}
              >
                {block.block_height}
              </p>
              <p style={latestBlockStyles.itemLarge}>{new Date(block.timestamp * 1000).toUTCString()}</p>
              <p style={latestBlockStyles.item}>{block.txs.length}</p>
              <p style={latestBlockStyles.item}>{(block.size / 1024).toFixed(3)}</p>
            </div>
          );
        });
      }
    }

    return (
      latest_blocks_jsx === null
        ? null
        :
         (
           <div style={latestBlockStyles.main}>
             <div style={latestBlockStyles.title}>
               <h3>Latest Blocks</h3>
             </div>
             <div style={latestBlockStyles.list}>
               <p style={Object.assign({}, latestBlockStyles.item, {fontWeight: "bold"})}>Height</p>
               <p style={Object.assign({}, latestBlockStyles.itemLarge, {fontWeight: "bold"})}>Timestamp</p>
               <p style={Object.assign({}, latestBlockStyles.item, {fontWeight: "bold"})}>Transactions</p>
               <p style={Object.assign({}, latestBlockStyles.item, {fontWeight: "bold"})}>Size (KB)</p>
             </div>
             {latest_blocks_jsx}
             <div style={latestBlockStyles.title}>
               <h3>BTC Mined: {(mined_btc/100000000).toFixed(8)} BTC</h3>
             </div>
           </div>
         )
    );
  }
}
