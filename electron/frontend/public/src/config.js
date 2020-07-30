const configDefaultState = null;
let configListenerSet = false;

let parseConfigParams = (res) => {
  try {
    let validConfigReply = Object.keys(res).every(testIncludes(["type", "data"]));
    if (validConfigReply) {
      if (res.type === "config" && res.data) {
        let validConfigKeys = Object.keys(res.data).filter(testIncludes(["host", "port", "log"])).length === 3;
        if (validConfigKeys) {
          let configParams = {
            host: res.data.host,
            port: res.data.port,
            log: res.data.log
          };
          if (res.data.tor) {
            configParams = Object.assign({}, configParams, {tor: true});
          }
          else {
            configParams = Object.assign({}, configParams, {tor: false});
          }
          return configParams;
        }
      }
    }
    return null;
  }
  catch(err) {
    return null;
  }
};

const SET_CONFIG = "SET_CONFIG";
const SET_PARAM = "SET_PARAM";

const setConfigActionCreator = (config) => ({
  type: SET_CONFIG,
  config
});

const setParamActionCreator = (param) => ({
  type: SET_PARAM,
  param
});

const getConfig = () => {
  return (dispatch) => {
    ipcRenderer.send("config-request");
    if (!configListenerSet) {
      ipcRenderer.on("config-response", (event, res) => {
        res = JSON.parse(res);
        let configParams = parseConfigParams(res);
        if (configParams !== null) {
          dispatch(setConfigActionCreator({
            err: null,
            configParams
          }));
        }
        else {
          dispatch(setConfigActionCreator({
            err: "Unable to read configuration!",
            configParams
          }));
        }
      });
    }
    configListenerSet = true;
  }
};

const modifyConfig = (configParams) => {
  return (dispatch) => {
    ipcRenderer.send("modify-config-request", configParams);
    ipcRenderer.on("modify-config-response", (event, res) => {
      res = JSON.parse(res);
      if (res.type === "config" && res.data) {
        let configParams = parseConfigParams(res);
        if (configParams !== null) {
          dispatch(setConfigActionCreator({
            err: null,
            configParams
          }));
        }
        else {
          dispatch(setConfigActionCreator({
            err: "Unable to read configuration!",
            configParams
          }));
        }
      }
      else {
        dispatch(setParamActionCreator({err: "Unable to modify configuration!"}));
      }
    });
  }
};

const restartSync = () => {
  return (dispatch) => {
    ipcRenderer.send("sync-restart");
  }
}

const restartRpc = () => {
  return (dispatch) => {
    ipcRenderer.send("rpc-restart");
  }
}

const configReducer = (state=configDefaultState, action) => {
    switch(action.type) {
      case SET_CONFIG:
        return action.config;
        break;
      case SET_PARAM:
        return Object.assign({}, state, action.param);
        break;
      default:
        return state;
    }
};
