const dataDefaultState = null;
let getDataListenerSet = false;
let refreshDataListenerSet = false;

const SET_DATA = "SET_DATA";
const UPDATE_DATA = "UPDATE_DATA";

const setDataActionCreator = (data) => ({
  type: SET_DATA,
  data
});

const updateDataActionCreator = (data) => ({
  type: UPDATE_DATA,
  data
});

let parseDataParams = (res) => {
  try {
    let validDataReply = Object.keys(res).every(testIncludes(["event_id", "type", "data"]));
    if (validDataReply) {
      if (["block", "address", "tx"].includes(res.type) && res.data) {
        return res;
      }
    }
    return null;
  }
  catch(err) {
    return null;
  }
};

let parseUpdateDataParams = (res, updateType) => {
  try {
    let validUpdateDataReply = Object.keys(res).every(testIncludes(["type", "data"]));
    if (validUpdateDataReply) {
      if (["block", "address", "tx"].includes(res.type) && res.data) {
        switch(updateType) {
          case "txinAmount":
          case "txinAmountStream":
            if (res.type == "tx") {
              return res.data.tx_outs.map((tx_out) => ({amount: tx_out.amount}));
            }
            return null;
            break;
          case "utxoStatus":
          case "utxoStatusStream":
          case "txBlock":
          case "txBlockStream":
            if (res.type == "block") {
              return res;
            }
            return null;
            break;
          case "addressSpentTx":
            if (res.type == "tx") {
              return res;
            }
            return null;
            break;
          default:
            return null;
        }
      }
    }
    return null;
  }
  catch(err) {
    return null;
  }
};

let updateTxinAmount = (state_tx_ins, query_tx_hash, update_tx_outs) => {
  return state_tx_ins.map((tx_in) => {
    if (tx_in.prev_tx === query_tx_hash && update_tx_outs[tx_in.prev_index] !== "undefined") {
      return Object.assign({}, tx_in, update_tx_outs[tx_in.prev_index]);
    }
    else {
      return tx_in;
    }
  });
};

const updateTxOuts = (state_tx, tx_hash, tx_index, update_block) => {
  let spent_match = {};
  let utxoStatus = {};
  let state_tx_hash = state_tx.tx_hash;
  let state_tx_outs = [...state_tx.tx_outs];
  if (state_tx_hash === tx_hash  && state_tx_outs[tx_index] !== undefined) {
    if (
      Object.keys(update_block).length > 0 &&
      Object.keys(update_block).includes("block_height") &&
      Object.keys(update_block).includes("block_hash")
    ) {
      let { block_height, block_hash } = update_block;
      update_block.txs.forEach((tx) => {
        tx.tx_ins.forEach((tx_in, index) => {
          if (tx_in.prev_tx === tx_hash && tx_in.prev_index === tx_index) {
            spent_match["tx_hash"] = tx.tx_hash;
            spent_match["index"] = index;
          }
        });
      });
      if (Object.keys(spent_match).every(testIncludes(["tx_hash", "index"]))) {
        utxoStatus = {
          spent: true,
          spending_block_height: block_height,
          spending_block_hash: block_hash,
          spending_tx_hash: spent_match.tx_hash,
          spending_index: spent_match.index
        };
      }
    }
    else {
      utxoStatus = {
        spent: false
      };
    }
    let update_tx_out = Object.assign(
      {},
      state_tx_outs[tx_index],
      {utxoStatus: utxoStatus}
    );
    let update_tx_outs = [
      ...state_tx_outs.slice(0, tx_index),
      update_tx_out,
      ...state_tx_outs.slice(tx_index + 1, )
    ];
    return Object.assign({}, state_tx, {tx_outs:update_tx_outs});
  }
  return null;
};

const clearData = () => {
  return (dispatch) => {
    dispatch(setDataActionCreator(null));
    ipcRenderer.send("cancel-request");
  }
}

const cancelFetch = () => {
  return (dispatch) => {
    ipcRenderer.send("cancel-request");
  }
}

const getData = (query)  => {
  return (dispatch) => {
    dispatch(setDataActionCreator(null));
    ipcRenderer.send("query-request", query);
    if (!getDataListenerSet) {
      ipcRenderer.on("query-response", (event, res) => {
        res = JSON.parse(res);
        let dataParams = parseDataParams(res);
        if (dataParams !== null) {
          dispatch(setDataActionCreator({
            err: null,
            dataParams
          }));
        }
        else {
          dispatch(setDataActionCreator({
            err: "Unable to fetch data!",
            dataParams
          }));
        }
      });
      getDataListenerSet = true;
    }
  };
};

const refreshData = (event_id, query, updateType)  => {
  return (dispatch) => {
    ipcRenderer.send("query-refresh-request", {event_id, updateType, query});
    if (!refreshDataListenerSet) {
      ipcRenderer.on("query-refresh-response", (event, res) => {
        let {updateType, query, payload} = res;
        payload = JSON.parse(payload);
        let updateDataParams = parseUpdateDataParams(payload, updateType);
        dispatch(updateDataActionCreator({
          query,
          updateType,
          updateDataParams
        }));
      });
      refreshDataListenerSet = true;
    }
  };
};

const dataReducer = (state=dataDefaultState, action) => {
  switch(action.type) {
    case SET_DATA:
      return action.data;
      break;
    case UPDATE_DATA:
      if (
        state !== null &&
        Object.keys(action.data).every(testIncludes(["query", "updateType", "updateDataParams"]))
      ) {
        switch(action.data.updateType) {
          case "txinAmount":
          case "txinAmountStream":
            if (state.err === null && action.data.updateDataParams !== null) {
              switch(state.dataParams.type) {
                case "tx":
                  try {
                    let state_tx_ins = [...state.dataParams.data.tx_ins];
                    let query_tx_hash = action.data.query;
                    let update_txouts = action.data.updateDataParams;
                    let tx_ins = updateTxinAmount(
                      state_tx_ins,
                      query_tx_hash,
                      update_txouts
                    );
                    let tx = state.dataParams.data;
                    tx = Object.assign({}, tx, {tx_ins:tx_ins});
                    let dataParams = Object.assign({}, state.dataParams, {data: tx});
                    return Object.assign({}, state, {dataParams: dataParams});
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                case "block":
                case "address":
                  try {
                    let state_txs = state.dataParams.data.txs;
                    let state_txs_spent = state.dataParams.data.txs_spent;
                    let query_tx_hash = action.data.query;
                    let update_txouts = action.data.updateDataParams;
                    let update_txs = state_txs.map((tx) => {
                      let tx_ins = updateTxinAmount(
                        tx.tx_ins,
                        query_tx_hash,
                        update_txouts
                      );
                      return Object.assign({}, tx, {tx_ins:tx_ins});
                    });

                    let update_data = Object.assign({}, state.dataParams.data, {txs: update_txs});

                    if (state_txs_spent !== undefined) {
                      let update_txs_spent = state_txs_spent.map((tx) => {
                        let tx_ins = updateTxinAmount(
                          tx.tx_ins,
                          query_tx_hash,
                          update_txouts
                        );
                        return Object.assign({}, tx, {tx_ins:tx_ins});
                      });
                      update_data = Object.assign({}, update_data, {txs_spent: update_txs_spent});
                    }

                    let dataParams = Object.assign({}, state.dataParams, {data: update_data});
                    return Object.assign({}, state, {dataParams: dataParams});
                  }
                  catch(err) {
                    return state;
                  }
                  break;
              }
            }
            return state;
            break;
          case "utxoStatus":
          case "utxoStatusStream":
            if (state.err === null && action.data.updateDataParams !== null) {
              switch(state.dataParams.type) {
                case "tx":
                  try {
                    let { tx_hash, tx_index } = action.data.query;
                    let update_block = action.data.updateDataParams.data;
                    let state_tx = state.dataParams.data;
                    let update_tx = updateTxOuts(state_tx, tx_hash, tx_index, update_block);
                    if (update_tx !== null) {
                      let dataParams = Object.assign({}, state.dataParams, {data: update_tx});
                      return Object.assign({}, state, {dataParams: dataParams});
                    }
                    return state;
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                case "block":
                case "address":
                  try {
                    let state_txs = state.dataParams.data.txs;
                    let state_txs_spent = state.dataParams.data.txs_spent;
                    let { tx_hash, tx_index } = action.data.query;
                    let update_block = action.data.updateDataParams.data;
                    let update_txs = state_txs.map((state_tx) => {
                      let update_tx = updateTxOuts(state_tx, tx_hash, tx_index, update_block);
                      if (update_tx !== null) {
                        return update_tx;
                      }
                      return state_tx;
                    });

                    let update_state_block = Object.assign({}, state.dataParams.data, {txs: update_txs});

                    if (state_txs_spent !== undefined) {
                      let update_txs_spent = state_txs_spent.map((state_tx_spent) => {
                        let update_tx_spent = updateTxOuts(state_tx_spent, tx_hash, tx_index, update_block);
                        if (update_tx_spent !== null) {
                          return update_tx_spent;
                        }
                        return state_tx_spent;
                      });
                      update_state_block = Object.assign({}, update_state_block, {txs_spent: update_txs_spent});
                    }

                    let dataParams = Object.assign({}, state.dataParams, {data: update_state_block});
                    return Object.assign({}, state, {dataParams: dataParams});
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                default:
                  return state;
              }
            }
            return state;
          case "txBlock":
          case "txBlockStream":
            if (state.err === null && action.data.updateDataParams !== null) {
              switch(state.dataParams.type) {
                case "tx":
                  try {
                    let tx_hash = action.data.query;
                    let update_block = action.data.updateDataParams.data;
                    let state_tx = state.dataParams.data;
                    if (state_tx.tx_hash === tx_hash) {
                      let update_tx = Object.assign(
                        {},
                        state_tx,
                        {
                          block_hash: update_block.block_hash,
                          block_height: update_block.block_height,
                          timestamp: update_block.timestamp
                        }
                      );
                      let dataParams = Object.assign({}, state.dataParams, {data: update_tx});
                      return Object.assign({}, state, {dataParams: dataParams});
                    }
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                case "address":
                  try {
                    let tx_hash = action.data.query;
                    let update_block = action.data.updateDataParams.data;
                    let state_txs = state.dataParams.data.txs;
                    let state_txs_spent = state.dataParams.data.txs_spent;
                    let update_txs = state_txs.map((tx) => {
                      if (tx.tx_hash === tx_hash) {
                        let update_tx = Object.assign(
                          {},
                          tx,
                          {
                            block_hash: update_block.block_hash,
                            block_height: update_block.block_height,
                            timestamp: update_block.timestamp
                          }
                        );
                        return update_tx;
                      }
                      return tx;
                    });
                    let update_data = Object.assign({}, state.dataParams.data, {txs: update_txs});

                    if (state_txs_spent !== undefined) {
                      if (Array.isArray(state_txs_spent) && state_txs_spent.length > 0) {
                        let update_txs_spent = state_txs_spent.map((tx) => {
                          if (tx.tx_hash === tx_hash) {
                            let update_tx = Object.assign(
                              {},
                              tx,
                              {
                                block_hash: update_block.block_hash,
                                block_height: update_block.block_height,
                                timestamp: update_block.timestamp
                              }
                            );
                            return update_tx;
                          }
                          return tx;
                        });
                        update_data = Object.assign({}, update_data, {txs_spent: update_txs_spent});
                      }
                    }

                    let dataParams = Object.assign({}, state.dataParams, {data: update_data});
                    return Object.assign({}, state, {dataParams: dataParams});
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                default:
                  return state;
              }
            }
            return state;
          case "addressSpentTx":
            if (state.err === null && action.data.updateDataParams !== null) {
              switch(state.dataParams.type) {
                case "address":
                  try {
                    let tx_hash = action.data.query;
                    let update_tx = action.data.updateDataParams.data;
                    let state_address = state.dataParams.data;
                    if (state_address.txs_spent === undefined) {
                      let txs_spent = [update_tx];
                      let update_data = Object.assign({}, state_address, {txs_spent: txs_spent});
                      let dataParams = Object.assign({}, state.dataParams, {data: update_data});
                      return Object.assign({}, state, {dataParams: dataParams});
                    }
                    if (Array.isArray(state_address.txs_spent)) {
                      let txs_spent = [...state_address.txs_spent, update_tx];
                      let update_data = Object.assign({}, state_address, {txs_spent: txs_spent});
                      let dataParams = Object.assign({}, state.dataParams, {data: update_data});
                      return Object.assign({}, state, {dataParams: dataParams});
                    }
                    return state;
                  }
                  catch(err) {
                    return state;
                  }
                  break;
                default:
                  return state;
              }
            }
            return state;
          default:
            return state;
        }
      }
      return state;
      break;
    default:
      return state;
  }
};
