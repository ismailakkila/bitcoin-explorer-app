const DNS_NODES = [
    "seed.bitcoin.sipa.be",
    "dnsseed.bluematt.me",
    "dnsseed.bitcoin.dashjr.org",
    "seed.bitcoinstats.com",
    "seed.bitcoin.jonasschnelli.ch",
    "seed.btc.petertodd.org"
];

const configStyles = {
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
  backButton: {
    fontFamily: "monospace",
    margin: "10px"
  },
  applyButton: {
    fontFamily: "monospace",
    margin: "10px"
  },
  configItems: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center"
  },
  configItem: {
    margin: "3px",
    width: "50%",
    display: "flex",
    flexDirection: "row",
  },
  itemStart: {
    width: "25%"
  },
  itemEnd: {
    width: "75%",
    fontFamily: "monospace"
  }
};

class Config extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hostPlaceholder: "",
      portPlaceholder: "",
      host: "",
      port: "",
      tor: "",
      log: "",
      disableSync: false,
      attribute: null
    };
    this.handleHost = this.handleHost.bind(this);
    this.handlePort = this.handlePort.bind(this);
    this.handleTor = this.handleTor.bind(this);
    this.handleLog = this.handleLog.bind(this);
    this.applyConfig = this.applyConfig.bind(this);
    this.forceResync = this.forceResync.bind(this);
  }

  handleHost(event) {
    this.setState({
      host: event.target.value
    });
  }

  handlePort(event) {
    this.setState({
      port: event.target.value
    });
  }

  handleTor(event) {
    if (event.target.value === "true") {
      this.setState({
        tor: true
      });
    }
    if (event.target.value === "false") {
      this.setState({
        tor: false
      });
    }
  }

  handleLog(event) {
    if (event.target.value === "INFO") {
      this.setState({
        log: "INFO"
      });
    }
    if (event.target.value === "DEBUG") {
      this.setState({
        log: "DEBUG"
      });
    }
  }

  applyConfig() {
    let {
      hostPlaceholder,
      portPlaceholder,
      torPlaceholder,
      logPlaceholder,
      host,
      port,
      tor,
      log
    } = this.state;

    let configParams = {
      tor,
      log
    };

    if (host) {
      configParams = Object.assign({}, configParams, {host:host});
    }
    else {
      configParams = Object.assign({}, configParams, {host:hostPlaceholder});
    }
    if (port) {
      configParams = Object.assign({}, configParams, {port:port});
    }
    else {
      configParams = Object.assign({}, configParams, {port:portPlaceholder});
    }
    this.props.modifyConfig(configParams);
  }

  forceResync() {
    this.props.restartSync();
    this.setState({
      disableSync: true
    });
    this.updateForceSync = setTimeout(() => {
      if (this._ismounted) {
        this.setState({
          disableSync: false
        });
      }
    }, 30000);
  }

  render() {
    let {
        hostPlaceholder,
        portPlaceholder,
        torPlaceholder,
        logPlaceholder,
        host,
        port,
        tor,
        log
      } = this.state;

    const getSyncStatus = () => {
      let syncStatusActive;
      let status = this.props.status;
      if (status !== null) {
        if (status.syncProcess !== undefined) {
          return status.syncProcess.active;
        }
      }
      return false;
    }

    return (
      <div style={this.props.darkMode ? Object.assign({}, configStyles.main, configStyles.mainDark): configStyles.main}>
        <div align="right">
          <button style={configStyles.backButton} onClick={this.props.toggleConfig}>Back</button>
        </div>
        <div style={configStyles.configItems} align= "center">
          <div style={configStyles.configItem}>
            <label style={configStyles.itemStart} htmlFor="host">Host</label>
            <input style={configStyles.itemEnd} onChange={this.handleHost} placeholder={hostPlaceholder} types="text" id="host" value={host}/>
          </div>
          <div style={configStyles.configItem}>
            <label style={configStyles.itemStart} htmlFor="port">Port</label>
            <input style={configStyles.itemEnd} onChange={this.handlePort} placeholder={portPlaceholder} type="text" id="port" value={port}/>
          </div>
          <div style={configStyles.configItem}>
            <label style={configStyles.itemStart} htmlFor="tor">Tor</label>
            <select style={configStyles.itemEnd} onChange={this.handleTor} value={tor ? "true" : "false"} id="tor">
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div style={configStyles.configItem}>
            <label style={configStyles.itemStart} htmlFor="log">Log</label>
            <select style={configStyles.itemEnd} onChange={this.handleLog} value={log} id="log">
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
        </div>
        <div align="center">
          <button
            style={configStyles.applyButton}
            onClick={this.applyConfig}
          >
            Apply
          </button>
          <button
            style={configStyles.forceResyncButton}
            onClick={this.forceResync}
            disabled={this.state.disableSync ? true : !getSyncStatus()}
          >
            Force Resync
          </button>
        </div>
      </div>
    )
  }

  componentDidMount() {
    this._ismounted = true;
    this.props.clearData();
    if (this.props.attribute !== null && this.state.attribute === null) {
      this.setState({attribute: this.props.attribute});
    }
    let { err, configParams } = this.props.config;
    if (err === null && configParams !== null) {
      let { host, port, tor, log } = configParams;
      this.setState({
        hostPlaceholder: host,
        portPlaceholder: port,
        tor: tor,
        log: log
      });
    }
    else {
      this.setState({
        hostPlaceholder: DNS_NODES[Math.floor(Math.random() * DNS_NODES.length)],
        portPlaceholder: "8333",
        tor: false,
        log: "INFO"
      });
    }
  }

  componentWillUnmount() {
    this._ismounted = false;
    clearTimeout(this.updateForceSync);
    if (this.state.attribute !== null) {
      this.props.getData(this.state.attribute);
    }
  }
}
