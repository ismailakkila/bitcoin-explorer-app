const zerorpc = require("zerorpc");
const ipcMain = require("electron").ipcMain;

const ZERORPC_PORT = 8999;
const HEARTBEAT_INTERVAL = 120000 * 5;
const TIMEOUT = 120 * 5 * 2;
const rpcClientOptions = {
  heartbeatInterval: HEARTBEAT_INTERVAL,
  timeout: TIMEOUT
};

function startRpcClient(logger) {
  
  function spawnRpcClient() {
    let client = new zerorpc.Client(rpcClientOptions);
    client.connect("tcp://127.0.0.1:" + ZERORPC_PORT);

    logger.log('info', 'Starting RPC client');
    logger.log('info', 'RPC client connected');

    client.on("error", (err) => {
      logger.log('error', `RPC client error: ${err}`);
    });
    return client;
  }

  let client = spawnRpcClient();

  ipcMain.on("config-request", (event) => {
    logger.log("info", "Incoming config-request from renderer");
    logger.log("info", "Invoking RPC client: get_config");
    client.invoke("get_config", (err, res, more) => {
      if (err) {
        logger.log('error', `RPC client error: ${err}`);
        event.sender.send("config-response", {
          type: "error",
          data: "rpc client error"
        });
      }
      else {
        logger.log('debug', `RPC server response: ${res}`);
        event.sender.send("config-response", res);
      }
    });
  });

  ipcMain.on("modify-config-request", (event, arg) => {
    logger.log("info", "Incoming modify-config-request from renderer");
    logger.log("info", "Invoking RPC client: modify_config");
    client.invoke("modify_config", arg, (err, res, more) => {
      if (err) {
        logger.log('error', `RPC client error: ${err}`);
        event.sender.send("modify-config-response", {
          type: "error",
          data: "rpc client error"
        });
      }
      else {
        logger.log('debug', `RPC server response: ${res}`);
        event.sender.send("modify-config-response", res);
      }
    });
  });

  ipcMain.on("status-request", (event) => {
    logger.log("info", "Incoming status-request from renderer");
    logger.log("info", "Invoking RPC client: get_sync_status");
    client.invoke("get_sync_status", (err, res, more) => {
      if (err) {
        logger.log('error', `RPC client error: ${err}`);
        event.sender.send("sync-response", {
          type: "error",
          data: "rpc client error"
        });
      }
      else {
        logger.log('debug', `RPC server response: ${res}`);
        event.sender.send("status-response", res);
      }
    });
  });

  ipcMain.on("latest-blocks-request", (event) => {
    logger.log("info", "Incoming latest-blocks-request from renderer");
    logger.log("info", "Invoking RPC client: get_latest_blocks");
    client.invoke("get_latest_blocks", (err, res, more) => {
      if (err) {
        logger.log('error', `RPC client error: ${err}`);
        event.sender.send("latest-blocks-response", {
          type: "error",
          data: "rpc client error"
        });
      }
      else {
        logger.log('debug', `RPC server response: ${res}`);
        event.sender.send("latest-blocks-response", res);
      }
    });
  });

  ipcMain.on("cancel-request", (event) => {
    logger.log("info", "Incoming cancel-request from renderer");
    logger.log("info", "Invoking RPC client: cancel");
    client.invoke("cancel", (err, res, more) => {
      if (err) {
        logger.log('error', `RPC client error: ${err}`);
      }
      else {
        logger.log('debug', `RPC server response: ${res}`);
        event.sender.send("cancel-response", res);
      }
    });
  });

  ipcMain.on("query-request", (event, arg) => {
    logger.log("info", "Incoming query-request from renderer");
    if (typeof arg === "string" || typeof arg === "number") {
      logger.log("info", `Received valid query request string: ${arg}`);
      if (Number(arg) !== NaN && Number(arg) >= 0) {
        logger.log('info', "Query string converted to integer");
        arg = parseInt(arg);
      }
      logger.log("info", `Invoking RPC client: get_attribute with query: ${arg}`);
      client.invoke("get_new_attribute", arg, (err, res, more) => {
        if (err) {
          logger.log('error', `RPC client error: ${err}`);
        }
        else {
          logger.log('debug', `RPC server response: ${res}`);
          event.sender.send("query-response", res);
        }
      });
    }
    else {
      logger.log("info", `Invalid query: ${arg}`);
    }
  });

  ipcMain.on("query-refresh-request", (event, arg) => {
    logger.log("info", "Incoming query-refresh-request from renderer");
    let {event_id, updateType, query} = arg;
    switch(updateType) {
      case "txinAmount":
      case "addressSpentTx":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        if (typeof query === "string" || typeof query === "number") {
          logger.log("info", `Received valid query refresh request string: ${query}`);
          if (Number(query) !== NaN && Number(query) >= 0) {
            logger.log('info', "Query string converted to integer");
            query = parseInt(query);
          }
          logger.log("info", `Invoking RPC client: get_update_attribute with query: ${query}`);
          client.invoke("get_update_attribute", event_id, query, (err, res, more) => {
            if (err) {
              logger.log('error', `RPC client error: ${err}`);
            }
            else {
              logger.log('debug', `RPC server response - updateType: ${updateType}`);
              logger.log('debug', `RPC server response - query: ${query}`);
              logger.log('debug', `RPC server response - payload: ${res}`);
              event.sender.send("query-refresh-response", {
                updateType,
                query,
                payload: res
              });
            }
          });
        }
        else {
          logger.log("info", `Invalid query: ${query}`);
        }
        break;
      case "txinAmountStream":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        if (Array.isArray(query)) {
          query = query.filter((item) => {
            if (typeof item === "string" || typeof item === "number") {
              return true;
            }
            return false;
          });
          query = query.map((item) => {
            if (Number(item) !== NaN && Number(item) >= 0) {
              return parseInt(item);
            }
            return item;
          });
          logger.log("info", `Invoking RPC client: get_attribute_stream - ${query.length} items`);
          let queryCount = 0;
          client.invoke("get_update_attribute_stream", event_id, query, (err, res, more) => {
            queryCount += 1;
            if (err) {
              logger.log('error', `RPC client error: ${err}`);
            }
            else {
              if (res !== undefined) {
                logger.log('debug', `RPC server response - updateType: ${updateType}`);
                logger.log('debug', `RPC server response - query: ${query[queryCount - 1]}`);
                logger.log('debug', `RPC server response - payload: ${res}`);
                event.sender.send("query-refresh-response", {
                  updateType,
                  query: query[queryCount - 1],
                  payload: res
                });
              }
            }
          });
        }
        else {
          logger.log("info", `Invalid query: ${query}`);
        }
        break;
      case "utxoStatus":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        let {tx_hash, tx_index} = query;
        if (typeof tx_hash === "string") {
          if (typeof tx_index === "string" || typeof tx_index === "number") {
            if (Number(tx_index) !== NaN && Number(tx_index) >= 0) {
              logger.log('info', "Tx index string converted to integer");
              tx_index = parseInt(tx_index);
            }
          }
          if (typeof tx_index === "number") {
            logger.log("info", `Received valid query refresh request string: ${tx_hash}:${tx_index}`);
            logger.log("info", `Invoking RPC client: get_utxo_status with query: ${tx_hash}:${tx_index}`);
            client.invoke("get_utxo_status", event_id, tx_hash, tx_index, (err, res, more) => {
              if (err) {
                logger.log('error', `RPC client error: ${err}`);
              }
              else {
                logger.log('debug', `RPC server response - updateType: ${updateType}`);
                logger.log('debug', `RPC server response - query: ${tx_hash}:${tx_index}`);
                logger.log('debug', `RPC server response - payload: ${res}`);
                event.sender.send("query-refresh-response", {
                  updateType,
                  query,
                  payload: res
                });
              }
            });
            break;
          }
        }
        logger.log("info", `Invalid query: ${tx_hash}:${tx_index}`);
        break;
      case "utxoStatusStream":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        if (Array.isArray(query)) {
          query = query.filter((item) => {
            let {tx_hash, tx_index} = item;
            if (typeof tx_hash === "string") {
              if (typeof tx_index === "string" || typeof tx_index === "number") {
                if (Number(tx_index) !== NaN && Number(tx_index) >= 0) {
                  return true;
                }
              }
            }
            return false;
          });
          query = query.map((item) => {
            let {tx_hash, tx_index} = item;
            return {tx_hash, tx_index: parseInt(tx_index)};
          });
          logger.log("info", `Invoking RPC client: get_utxo_status_stream - ${query.length} items`);
          let queryCount = 0;
          client.invoke("get_utxo_status_stream", event_id, query, (err, res, more) => {
            queryCount += 1;
            if (err) {
              logger.log('error', `RPC client error: ${err}`);
            }
            else {
              if (res !== undefined) {
                let { tx_hash, tx_index } = query[queryCount - 1];
                logger.log('debug', `RPC server response - updateType: ${updateType}`);
                logger.log('debug', `RPC server response - query: ${tx_hash}:${tx_index}`);
                logger.log('debug', `RPC server response - payload: ${res}`);
                event.sender.send("query-refresh-response", {
                  updateType,
                  query: query[queryCount - 1],
                  payload: res
                });
              }
            }
          });
        }
        else {
          logger.log("info", `Invalid query: ${query}`);
        }
        break;
      case "txBlock":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        if (typeof query === "string") {
          logger.log("info", `Received valid query refresh request string: ${query}`);
          logger.log("info", `Invoking RPC client: get_tx_block with query: ${query}`);
          client.invoke("get_tx_block", event_id, query, (err, res, more) => {
            if (err) {
              logger.log('error', `RPC client error: ${err}`);
            }
            else {
              logger.log('debug', `RPC server response - updateType: ${updateType}`);
              logger.log('debug', `RPC server response - query: ${query}`);
              logger.log('debug', `RPC server response - payload: ${res}`);
              event.sender.send("query-refresh-response", {
                updateType,
                query,
                payload: res
              });
            }
          });
        }
        else {
          logger.log("info", `Invalid query: ${query}`);
        }
        break;
      case "txBlockStream":
        logger.log("info", `Incoming query-refresh-request is type: ${updateType}`);
        if (Array.isArray(query)) {
          query = query.filter((item) => {
            if (typeof item === "string") {
              return true;
            }
            return false;
          });
          logger.log("info", `Invoking RPC client: get_tx_block_stream - ${query.length} items`);
          let queryCount = 0;
          client.invoke("get_tx_block_stream", event_id, query, (err, res, more) => {
            queryCount += 1;
            if (err) {
              logger.log('error', `RPC client error: ${err}`);
            }
            else {
              if (res !== undefined) {
                let { tx_hash, tx_index } = query[queryCount - 1];
                logger.log('debug', `RPC server response - updateType: ${updateType}`);
                logger.log('debug', `RPC server response - query: ${query[queryCount - 1]}`);
                logger.log('debug', `RPC server response - payload: ${res}`);
                event.sender.send("query-refresh-response", {
                  updateType,
                  query: query[queryCount - 1],
                  payload: res
                });
              }
            }
          });
        }
        else {
          logger.log("info", `Invalid query: ${query}`);
        }
      default:
        logger.log("info", `Invalid query update type: ${updateType}`);
    }
  });

  return client;
}

module.exports = startRpcClient;
