const statusDefaultState = null;
let getStatusListenerSet = false;
const SET_STATUS = "SET_STATUS";
const UPDATE_STATUS = "UPDATE_STATUS";

let parseStatusParams = (res) => {
  try {
    let validStatusReply = Object.keys(res).every(testIncludes(["type", "data"]));
    if (validStatusReply) {
      if (res.type === "status" && res.data) {
        return res;
      }
    }
    return null;
  }
  catch(err) {
    return null;
  }
};

const setStatusActionCreator = (status) => ({
  type: SET_STATUS,
  status
});

const updateStatusActionCreator = (status) => ({
  type: UPDATE_STATUS,
  status
});

const getStatus = () => {
  return (dispatch) => {
    ipcRenderer.send("status-request");
    ipcRenderer.send("sync-status-request");
    ipcRenderer.send("rpc-status-request");
    if (!getStatusListenerSet) {
      ipcRenderer.on("status-response", (event, res) => {
        res = JSON.parse(res);
        let statusParams = parseStatusParams(res);
        if (statusParams !== null) {
          dispatch(updateStatusActionCreator({
            syncStatus: {
              err: null,
              statusParams
            }
          }));
        }
        else {
          dispatch(updateStatusActionCreator({
            syncStatus: {
              err: "Unable to read sync progress!",
              statusParams
            }
          }));
        }
      });

      ipcRenderer.on("sync-status-response", (event, res) => {
        dispatch(updateStatusActionCreator({
          syncProcess: res
        }));
      });

      ipcRenderer.on("rpc-status-response", (event, res) => {
        dispatch(updateStatusActionCreator({
          rpcProcess: res
        }));
      });
      getStatusListenerSet = true;
    }
  }
};

const statusReducer = (state=statusDefaultState, action) => {
  switch(action.type) {
    case SET_STATUS:
      return action.status;
      break;
    case UPDATE_STATUS:
      if (state === null) {
        return action.status;
        break;
      }
      else {
        return Object.assign({}, state, action.status);
        break;
      }
      return state;
      break;
    default:
      return state;
  }
};
