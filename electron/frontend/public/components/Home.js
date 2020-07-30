let homeStyles = {
  main: {
    fontFamily: "monospace",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh"
  },
  mainDark: {
    backgroundColor: "#121212",
    color: "white"
  },
  buttonsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  search: {
    width: "85%"
  },
  searchField: {
    fontFamily: "monospace",
    width: "75%",
    outline: "none"
  },
  searchButton: {
    fontFamily: "monospace",
    margin: "10px"
  },
  configButton: {
    fontFamily: "monospace",
    margin: "10px"
  },
  themeButton: {
    fontFamily: "monospace",
    margin: "10px"
  }
};

class Home extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      input: "",
      configEnabled: false,
      showModifyConfig: false,
      darkMode: false,
      loading: false
    };
    this.handleInput = this.handleInput.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.toggleConfig = this.toggleConfig.bind(this);
    this.toggleTheme = this.toggleTheme.bind(this);
    this.getData = this.getData.bind(this);
    this.getLatestBlocks = this.getLatestBlocks.bind(this);
  }

  handleInput(event) {
    this.setState({
      input: event.target.value
    });
  }

  handleKeyPress(e) {
    if (e.keyCode === 13) {
      this.handleSubmit();
    }
  }

  handleSubmit() {
    if (this.state.input !== "") {
      this.props.getData(this.state.input);
      this.setState({
        input: "",
        loading: true
      });
    }
  }

  toggleConfig() {
    this.setState((state, props) => ({
      showModifyConfig: !state.showModifyConfig
    }));
    this.props.getConfig();
  }

  toggleTheme() {
    this.setState((state, props) => {
      return {
        darkMode: !state.darkMode
      }
    });
  }

  getData(data) {
    this.props.getData(data);
    this.setState({
      loading: true
    });
  }

  getLatestBlocks() {
    this.props.clearData();
    this.props.getLatestBlocks();
  }

  render() {
    //console.log(this.state);
    console.log(this.props);
    let sync_status = null;
    let sync_block_height = null;
    if (this.props.status !== null) {
      if (this.props.status.syncStatus !== undefined) {
        let {err, statusParams} = this.props.status.syncStatus;
        if (err === null) {
          let {type, data} = statusParams;
          if (type === "status") {
            let status = data.split(":")[0];
            let sync_block_height = data.split(":")[1].split(" block height ")[1];
            if (status == "syncing") {
              sync_status = `Syncing - Latest Block Height: ${sync_block_height}`;
            }
            else {
              sync_status = `Latest Block Height: ${sync_block_height}`;
            }
          }
        }
      }
    }
    let displayData = null;
    let attribute = null;
    const placeholder = "Block height, hash, transaction, or address";
    if (this.props.data !== null) {
      let { err, dataParams } = this.props.data;
      if (err === null) {
        let { event_id, type, data } = dataParams;
        switch(type) {
          case "block":
            attribute = data.block_hash;
            displayData = (
                <Block
                  darkMode={this.state.darkMode}
                  event_id={event_id}
                  block={data}
                  getData={this.getData}
                  refreshData={this.props.refreshData}
                />
              )
            break;
          case "tx":
            attribute = data.tx_hash;
            displayData = (
              <Tx
                darkMode={this.state.darkMode}
                event_id={event_id}
                tx={data}
                details={true}
                getData={this.getData}
                refreshData={this.props.refreshData}
              />
            );
            break;
          case "address":
            attribute = data.address_raw;
            displayData = (
              <Address
                darkMode={this.state.darkMode}
                event_id={event_id}
                address={data}
                getData={this.getData}
                refreshData={this.props.refreshData}
              />
            );
            break;
          default:
            displayData = null;
        }
      }
      else {
        displayData = (
          <div style={{height: "100%"}} align="center">
            <h3>Not Found : (</h3>
          </div>
        )
      }
    }
    return (
      !this.state.showModifyConfig
        ?
          (
            <div style={this.state.darkMode ? Object.assign({}, homeStyles.main, homeStyles.mainDark): homeStyles.main}>
              <div style={homeStyles.buttonsRow}>
                <div>
                  <button style={homeStyles.themeButton} onClick={this.toggleTheme}>{this.state.darkMode ? "Light Mode" : "Dark Mode"}</button>
                </div>
                {
                  sync_status !== null &&
                    (
                      <div>
                        <p>{sync_status}</p>
                      </div>
                    )
                }
                {
                  this.props.config !== null &&
                    (
                      <div>
                        <button style={homeStyles.configButton} onClick={this.toggleConfig}>Config</button>
                      </div>
                    )
                }
              </div>
              <div align="center">
                <h1
                  onClick={this.getLatestBlocks}
                  style={{cursor: "pointer"}}
                >
                  Bitcoin Explorer
                </h1>
                <div style={homeStyles.search}>
                  <input
                    style={homeStyles.searchField}
                    type="text"
                    onChange={this.handleInput}
                    onKeyDown={this.handleKeyPress}
                    placeholder={placeholder}
                    value={this.state.input}
                  />
                  <button  style={homeStyles.searchButton} onClick={this.handleSubmit}>Search</button>
                </div>
              </div>
              {
                displayData === null && this.state.loading &&
                  (
                    <div style={{height: "100%"}} align="center">
                      <h3>Fetching...</h3>
                    </div>
                  )
              }
              {
                displayData === null && !this.state.loading && this.props.latest !== null &&
                  (
                    <div style={{height: "100%"}} align="center">
                      <Latest_Blocks
                        blocks={this.props.latest.blocks}
                        getData={this.getData}
                      />
                    </div>
                  )
              }
              {
                displayData !== null &&
                  (
                    <div align="center">
                      {displayData}
                    </div>
                  )
              }
            </div>
          )
        :
          (
            <Config
              darkMode={this.state.darkMode}
              config={this.props.config}
              status = {this.props.status}
              attribute={attribute}
              modifyConfig={this.props.modifyConfig}
              toggleConfig={this.toggleConfig}
              restartSync={this.props.restartSync}
              restartRpc={this.props.restartRpc}
              getData={this.getData}
              clearData={this.props.clearData}
            />
          )
    )
  }

  componentDidUpdate() {
    if (this.state.loading && this.props.data !== null) {
      this.setState({loading: false});
    }
  }

  componentDidMount() {
    this.props.getConfig();
    this.props.getStatus();
    this.props.getLatestBlocks();
    this.updateSyncStatus = setInterval(() => {
      this.props.getStatus();
    }, 15000);
    this.updateBlocksStatus = setInterval(() => {
      this.props.getLatestBlocks();
    }, 120000);
  }

  componentWillUnmount() {
    clearInterval(this.updateSyncStatus);
    clearInterval(this.updateBlocksStatus);
    this.props.cancelFetch();
  }
}
