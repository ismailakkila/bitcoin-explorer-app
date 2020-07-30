const SET_LATEST = "SET_LATEST";
const UPDATE_LATEST_BLOCKS = "UPDATE_LATEST_BLOCKS";
const UPDATE_LATEST_TXS = "UPDATE_LATEST_TXS";
const latestDefaultState = null;

let getLatestBlocksListenerSet = false;

let parseLatestBlocksParams = (res) => {
  try {
    let validLatestBlocksReply = Object.keys(res).every(testIncludes(["type", "data"]));
    if (validLatestBlocksReply) {
      if (res.type === "block" && Array.isArray(res.data)) {
        return res;
      }
    }
    return null;
  }
  catch(err) {
    return null;
  }
};

const setLatestActionCreator = (latest) => ({
  type: SET_LATEST,
  latest
});

const updateLatestBlocksActionCreator = (latestBlocks) => ({
  type: UPDATE_LATEST_BLOCKS,
  latestBlocks
});

const updateLatestTxsActionCreator = (latestTxs) => ({
  type: UPDATE_LATEST_TXS,
  latestTxs
});

const getLatestBlocks = () => {
  return (dispatch) => {
    ipcRenderer.send("latest-blocks-request");
    if (!getLatestBlocksListenerSet) {
      ipcRenderer.on("latest-blocks-response", (event, res) => {
        res = JSON.parse(res);
        let latestBlocksParams = parseLatestBlocksParams(res);
        if (latestBlocksParams !== null) {
          dispatch(updateLatestBlocksActionCreator({
            err: null,
            latestBlocksParams
          }));
        }
        else {
          dispatch(setLatestActionCreator({
            err: "Unable to retrieve latest information!",
            latestBlocksParams
          }));
        }
      });
      getLatestBlocksListenerSet = true;
    }
  };
}

const latestReducer = (state=latestDefaultState, action) => {
  switch(action.type) {
    case SET_LATEST:
      return action.latest;
    case UPDATE_LATEST_BLOCKS:
      return Object.assign({}, state, {blocks: action.latestBlocks});
    case UPDATE_LATEST_TXS:
      return Object.assign({}, state, {txs: action.latestTxs});
    default:
      return state;
  }
}
