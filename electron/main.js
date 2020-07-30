const { app, BrowserWindow } = require("electron");
const { spawn } = require('child_process');
const os = require("os");
const path = require("path");
const fs = require("fs");
const ipcMain = require("electron").ipcMain;
const rpcClient = require("./rpcClient");
const getLogger = require("./logger");
const zerorpc = require("zerorpc");

const DIST_HOME_FOLDER_UNIX = path.join(os.homedir(), ".bitcoin-explorer-app");
const DIST_HOME_FOLDER_WIN = path.join(os.homedir(), "bitcoin-explorer-app");
const DIST_DB_FOLDER_UNIX = path.join(os.homedir(), ".bitcoin-explorer-app", "db");
const DIST_DB_FOLDER_WIN = path.join(os.homedir(), "bitcoin-explorer-app", "db");
const ZERORPC_PORT = 8999;
const HEARTBEAT_INTERVAL = 120000 * 5;
const TIMEOUT = 120 * 5 * 2;
const rpcClientOptions = {
  heartbeatInterval: HEARTBEAT_INTERVAL,
  timeout: TIMEOUT
};

var ui;
var spawnedSync;
var spawnedRPC;
var spawnedMongo;
var zerorpcClient;
var logger;
var beforeQuit = false;
var attempts = 0;
const MAXATTEMPTS = 15;

function processesClosed(processes) {
  return new Promise(function(resolve, reject) {
    var allClosed = processes.every(function(process) {
      return getBackendProcess(process) === null;
    });
    if (allClosed) {
      attempts = 0;
      resolve(true);
    }
    else {
      if (attempts > MAXATTEMPTS) {
        attempts = 0;
        resolve(false);
      }
      else {
        attempts += 1;
        setTimeout(function() {
          processesClosed(processes).then(function(result) {
            resolve(result);
          });
        }, 1000);
      }
    }
  });
}

function stopBackendProcess(process) {
  return new Promise(function(resolve, reject) {
    interruptBackendProcess(process);
    processesClosed([process])
      .then(function(result) {
        if (result) {
          resolve(true);
        }
        else {
          terminateBackendProcess(process);
          return processesClosed([process]);
        }
      })
      .then(function(result) {
        if (result) {
          resolve(true);
        }
        else {
          killBackendProcess(process);
          return processesClosed([process]);
        }
      })
      .then(function(result) {
        if (result) {
          resolve(true);
        }
        else {
          reject("Unable to kill process");
        }
      });
  });

}

function interruptBackendProcess(process) {
  switch(process) {
    case "main":
      if (spawnedSync) {
        console.log(`Stopping process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGINT`);
        logger.log('info', `Stopping process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGINT`);
        spawnedSync.kill("SIGINT");
      }
      break;
    case "rpc_interface":
      if (spawnedRPC) {
        console.log(`Stopping process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGINT`);
        logger.log('info', `Stopping process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGINT`);
        spawnedRPC.kill("SIGINT");
      }
      break;
    case "mongod":
      if (spawnedMongo) {
        console.log(`Stopping process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGINT`);
        logger.log('info', `Stopping process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGINT`);
        spawnedMongo.kill("SIGINT");
      }
      break;
  }
}

function terminateBackendProcess(process) {
  switch(process) {
    case "main":
      if (spawnedSync) {
        console.log(`Terminating process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGTERM`);
        logger.log('info', `Terminiating process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGTERM`);
        spawnedSync.kill("SIGTERM");
      }
      break;
    case "rpc_interface":
      if (spawnedRPC) {
        console.log(`Terminating process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGTERM`);
        logger.log('info', `Terminiating process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGTERM`);
        spawnedRPC.kill("SIGTERM");
      }
      break;
    case "mongod":
      if (spawnedMongo) {
        console.log(`Terminating process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGTERM`);
        logger.log('info', `Terminiating process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGTERM`);
        spawnedMongo.kill("SIGTERM");
      }
      break;
  }
}

function killBackendProcess(process) {
  switch(process) {
    case "main":
      if (spawnedSync) {
        console.log(`Killing process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGKILL`);
        logger.log('info', `Killing process: spawnedSync - PID: ${spawnedSync.pid} - SIGNAL: SIGKILL`);
        spawnedSync.kill("SIGKILL");
      }
      break;
    case "rpc_interface":
      if (spawnedRPC) {
        console.log(`Killing process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGKILL`);
        logger.log('info', `Killing process: spawnedRPC - PID: ${spawnedRPC.pid} - SIGNAL: SIGKILL`);
        spawnedRPC.kill("SIGKILL");
      }
      break;
    case "mongod":
      if (spawnedMongo) {
        console.log(`Killing process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGKILL`);
        logger.log('info', `Killing process: spawnedMongo - PID: ${spawnedMongo.pid} - SIGNAL: SIGKILL`);
        spawnedMongo.kill("SIGKILL");
      }
      break;
  }
}

function torExecutableCopy() {
  var tor_path = distAvailable("tor");
  if (tor_path) {
    console.log('Tor executable found: ' + tor_path);
    logger.log('info', 'Tor executable found: ' + tor_path);
    var f = path.basename(tor_path);
    var s = fs.createReadStream(tor_path);
    var d_path;
    var d;
    switch(process.platform) {
      case "darwin":
      case "linux":
        d_path = path.join(DIST_HOME_FOLDER_UNIX, f);
        d = fs.createWriteStream(d_path);
        break;
      case "win32":
        d_path = path.join(DIST_HOME_FOLDER_WIN, f);
        d = fs.createWriteStream(d_path);
        break;
      default:
        break;
    }
    s.on("end", function() {
      console.log('Tor executable successfully copied to home user directory');
      logger.log('info', 'Tor binary successfully copied to home user directory');
      fs.chmodSync(d_path, 0o777);
    });
    s.on("error", function() {
      console.log('Tor executable copy to home user directory has failed');
      logger.log('info', 'Tor binary copy to home user directory has failed');
    });
    if (d && d_path) {
      s.pipe(d);
      return;
    }
    console.log('Unsupported OS for tor executable copy operation');
    logger.log('info', 'Unsupported OS for tor executable copy operation');
    return;

  }
  console.log('Tor executable not found');
  logger.log('info', 'Tor executable not found');
}

function getBackendProcess(process) {
  switch(process) {
    case "main":
      return spawnedSync;
      break;
    case "rpc_interface":
      return spawnedRPC;
      break;
    case "mongod":
      return spawnedMongo;
      break;
  }
}

function distsAvailable() {
  var dists = ["main", "rpc_interface", "mongod"];
  switch(process.platform) {
    case "darwin":
      var available1 = dists.every((dist) => {
        var splitPath = app.getAppPath().split("/app.asar")
        var filePath = path.join(splitPath[0], "app.asar.unpacked", "backend", dist);
        return fs.existsSync(filePath);
      });
      var available2 = dists.every((dist) => {
        var filePath = path.join(app.getAppPath(), "backend", dist);
        return fs.existsSync(filePath);
      });
      if (available1) {
        return true;
      }
      else if (available2) {
        return true;
      }
      else {
        return false;
      }
      break;
    case "linux":
      return dists.every((dist) => {
        var filePath = path.join(app.getAppPath(), "backend", dist);
        return fs.existsSync(filePath);
      });
      break;
    case "win32":
      return dists.every((dist) => {
        var filePath = path.join(app.getAppPath(), "backend", dist + ".exe");
        return fs.existsSync(filePath);
      });
      break;
    default:
      return false;
      break;
  }
}

function distAvailable(dist) {
  var distPath;
  switch(process.platform) {
    case "darwin":
      var splitPath = app.getAppPath().split("/app.asar");
      var distPath1 = path.join(splitPath[0], "app.asar.unpacked", "backend", dist);
      distPath2 = path.join(app.getAppPath(), "backend", dist);
      if (fs.existsSync(distPath1)) {
        return distPath1;
      }
      else if (fs.existsSync(distPath2)) {
        return distPath2;
      }
      else {
        return false;
      }
      break;
    case "linux":
      distPath = path.join(app.getAppPath(), "backend", dist);
      if (fs.existsSync(distPath)) {
        return distPath;
      }
      return false;
      break;
    case "win32":
      distPath = path.join(app.getAppPath(), "backend", dist + ".exe");
      if (fs.existsSync(distPath)) {
        return distPath;
      }
      return false;
      break;
    default:
      return false;
      break;
  }
}

function get_db_path() {
  var databasePath;
  if (!distsAvailable()) {
    if (fs.existsSync(path.join(app.getAppPath(), "../db"))) {
      databasePath = path.join(app.getAppPath(), "../db");
    }
    else {
      fs.mkdirSync(path.join(app.getAppPath(), "../db"), 0744);
      databasePath = path.join(app.getAppPath(), "../db");
    }
  }
  else {
    switch (process.platform) {
      case "darwin":
      case "linux":
        if (fs.existsSync(DIST_DB_FOLDER_UNIX)) {
          databasePath = path.join(DIST_DB_FOLDER_UNIX);
        }
        else {
          fs.mkdirSync(DIST_DB_FOLDER_UNIX, 0744);
          databasePath = path.join(DIST_DB_FOLDER_UNIX);
        }
        break;
      case "win32":
        if (fs.existsSync(DIST_DB_FOLDER_WIN)) {
          databasePath = path.join(DIST_DB_FOLDER_WIN);
        }
        else {
          fs.mkdirSync(DIST_DB_FOLDER_WIN, 0744);
          databasePath = path.join(DIST_DB_FOLDER_WIN);
        }
        break;
      default:
        if (fs.existsSync(path.join(app.getAppPath(), "../db"))) {
          databasePath = path.join(app.getAppPath(), "../db");
        }
        else {
          fs.mkdirSync(path.join(app.getAppPath(), "../db"), 0744);
          databasePath = path.join(app.getAppPath(), "../db");
        }
        break;
    }
  }
  return databasePath;
}

function spawnRpcClient() {
  var client = new zerorpc.Client(rpcClientOptions);
  client.connect("tcp://127.0.0.1:" + ZERORPC_PORT);

  console.log('Starting RPC client to obtain configuration');
  logger.log('info', 'Starting RPC client to obtain configuration');
  console.log('RPC client connected');
  logger.log('info', 'RPC client connected');

  client.on("error", (err) => {
    console.log(`RPC client error: ${err}`);
    logger.log('error', `RPC client error: ${err}`);
  });
  return client;
}

function spawnSyncBackend() {
  var distPath = distAvailable('main');

  if (distPath && distsAvailable()) {
    console.log(`Sync executable path: ${distPath} --dist`);
    logger.log('info', `Sync executable path: ${distPath} --dist`);
    spawnedSync = spawn(distPath, ["--dist"]);
    console.log('Spawning sync backend');
    logger.log('info', 'Spawning sync backend');
  }
  else {
    console.log("Sync script path: ./bin/python3 ../main.py");
    logger.log('info', "Sync script path: ./bin/python3 ../main.py");
    spawnedSync = spawn("../bin/python3", ["../main.py"]);
    console.log('Spawning sync backend');
    logger.log('info', 'Spawning sync backend');
  }

  if (spawnedSync !== undefined) {

    spawnedSync.stdout.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedSync.stderr.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedSync.on('close', (code, signal) => {
        console.log(`spawnedSync child close: ${code}, ${signal}`);
    });

    spawnedSync.on('exit', (code, signal) => {
        console.log(`spawnedSync child exit: ${code}, ${signal}`);
        spawnedSync = null;
    });

    spawnedSync.on('error', (err) => console.error(err));

    console.log('Spawned sync backend');
    logger.log('info', 'Spawned sync backend');
  }
  else {
    console.log('Failed to spawn sync backend');
    logger.log('info', 'Failed to spawn sync backend');
  }

  return spawnedSync;
}

function spawnRPCBackend() {
  var distPath = distAvailable('rpc_interface');

  if (distPath && distsAvailable()) {
    console.log(`RPC executable path: ${distPath} --dist`);
    logger.log('info', `RPC executable path: ${distPath} --dist`);
    spawnedRPC = spawn(distPath, ["--dist"]);
    console.log('Spawned RPC backend');
    logger.log('info', 'Spawned RPC backend');
  }
  else {
    console.log("RPC script path: ./bin/python3 ../rpc_interface.py");
    logger.log('info', "RPC script path: ./bin/python3 ../rpc_interface.py");
    spawnedRPC = spawn("../bin/python3", ["../rpc_interface.py"]);
    console.log('Spawned RPC backend');
    logger.log('info', 'Spawned RPC backend');
  }

  if (spawnedRPC !== undefined) {

    spawnedRPC.stdout.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedRPC.stderr.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedRPC.on('close', (code, signal) => {
        console.log(`spawnedRPC child close: ${code}, ${signal}`);
    });

    spawnedRPC.on('exit', (code, signal) => {
        console.log(`spawnedRPC child exit: ${code}, ${signal}`);
        spawnedRPC = null;
    });

    spawnedRPC.on('error', (err) => console.error(err));

    console.log('Spawned RPC backend');
    logger.log('info', 'Spawned RPC backend');
  }
  else {
    console.log('Failed to spawn rpc backend');
    logger.log('info', 'Failed to spawn rpc backend');
  }

  return spawnedRPC;
}

function spawnMongoBackend() {
  var distPath = distAvailable('mongod');
  var db_path = get_db_path();

  if (distPath) {
    console.log(`Database executable path: ${distPath} --dbpath=${db_path}`);
    logger.log('info', `Database executable path: ${distPath} --dbpath=${db_path}`);
    console.log('Spawning MongoDB backend');
    logger.log('info', 'Spawning MongoDB backend');
    spawnedMongo = spawn(distPath, ["--dbpath=" + db_path]);
  }
  else {
    console.log("Mongod executable not found!");
    logger.log('info', "Mongod executable not found!");
  }

  if (spawnedMongo !== undefined) {

    spawnedMongo.stdout.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedMongo.stderr.on('data', (data) => {
      console.log(data.toString('ascii'))
    });

    spawnedMongo.on('close', (code, signal) => {
        console.log(`spawnedMongo child close: ${code}, ${signal}`);
    });

    spawnedMongo.on('exit', (code, signal) => {
        console.log(`spawnedMongo child exit: ${code}, ${signal}`);
        spawnedMongo = null;
    });

    spawnedMongo.on('error', (err) => console.error(err));

    console.log('Spawned MongoDB backend');
    logger.log('info', 'Spawned MongoDB backend');
  }
  else {
    console.log('Failed to spawn mongodb backend');
    logger.log('info', 'Failed to spawn mongodb backend');
  }

  return spawnedMongo;
}

ipcMain.on("sync-status-request", (event) => {
  if (spawnedSync) {
    event.sender.send("sync-status-response", {
      pid: spawnedSync.pid,
      active: true
    });
  }
  else {
    event.sender.send("sync-status-response", {
      pid: null,
      active: false
    });
  }
});

ipcMain.on("sync-restart", (event) => {
  logger.log("info", "Incoming sync-restart from renderer");
  stopBackendProcess("main")
    .then(function(result) {
      console.log("Starting python sync process");
      logger.log("info", "Starting python sync process");
      setTimeout(function() {
        spawnSyncBackend();
      }, 5000);
    })
    .catch(function(err) {
      console.log(err);
      logger.log("info", err);
    });
});

ipcMain.on("rpc-status-request", (event) => {
  if (spawnedRPC) {
    event.sender.send("rpc-status-response", {
      pid: spawnedRPC.pid,
      active: true
    });
  }
  else {
    event.sender.send("rpc-status-response", {
      pid: null,
      active: false
    });
  }
});

ipcMain.on("rpc-restart", (event) => {
  logger.log("info", "Incoming rpc-restart from renderer");
  stopBackendProcess("rpc_interface")
    .then(function(result) {
      console.log("Starting python rpc process");
      logger.log("info", "Starting python rpc process");
      spawnRPCBackend();
    })
    .catch(function(err) {
      console.log(err);
      logger.log("info", err);
    });
});

function createWindow(logLevel="info") {
  ui = new BrowserWindow({
    width: 800,
    height: 740,
    minWidth: 800,
    minHeight: 740,
    resizable: true,
    webPreferences: {
      preload: `${__dirname}/preload.js`
    }
  });

  ui.loadFile("index.html");

  ui.on("closed", function() {
    ui = null
  });

  if (logLevel === "debug") {
    ui.webContents.openDevTools();
  }

  console.log('Created electron window');
  logger.log('info', 'Created electron window');
}

app.on("ready", function() {
  logger = getLogger("info", distsAvailable());
  if (logger) {
    torExecutableCopy();
    spawnedMongo = spawnMongoBackend();
    if (spawnedMongo) {
      spawnedSync = spawnSyncBackend();
      if (spawnedSync) {
        spawnedRPC = spawnRPCBackend();
        if (spawnedRPC) {
          zerorpcClient = spawnRpcClient(logger);
          setTimeout(function() {
            console.log("Obtaining configuration file via RPC");
            zerorpcClient.invoke("get_config", (err, res, more) => {
              if (err) {
                console.log(`RPC client error: ${err}`);
                logger.log('info', `RPC client error: ${err}`);
              }
              else {
                console.log(`RPC server response: ${res}`);
                logger.log('info', `RPC server response: ${res}`);
                res = JSON.parse(res);
                if (res.type === "config") {
                  var logLevel = res.data.log.toLowerCase();
                  logger.transports[0].level = logLevel;
                  zerorpcClient.close();
                  zerorpcClient = rpcClient(logger);
                  createWindow(logLevel);
                }
              }
            });
          }, 5000);
        }
        else {
          app.quit();
        }
      }
      else {
        app.quit();
      }
    }
    else {
      app.quit();
    }
  }
  else {
    console.log("Logging cannot be initialized!")
    app.quit();
  }
});

app.on("window-all-closed", function() {
  if (process.platform !== "darwin") {
    stopBackendProcess("rpc_interface")
      .then(function(result) {
        return stopBackendProcess("main");
      })
      .catch(function(err) {
        console.log(err);
        logger.log("info", err);
      });
  }
});

app.on("will-quit", function(event) {
  if (!beforeQuit) {
    beforeQuit = true;
    console.log("Closing Processes");
    event.preventDefault();
    if (zerorpcClient) {
      zerorpcClient.close();
    }
    stopBackendProcess("rpc_interface")
      .then(function(result) {
        return stopBackendProcess("main");
      })
      .then(function(result) {
        return stopBackendProcess("mongod");
      })
      .then(function(result) {
        app.quit();
      })
      .catch(function(err) {
        console.log(err);
        logger.log("info", err);
      });
  }
});

app.on("quit", function(event) {
  if (logger) {
    console.log("Closing logger");
    logger.log("info", "Shutting Down");
    logger.close();
  }
  console.log("Shutting Down");
});

app.on("activate", function() {
  console.log("App activated");
  logger.log("info", "App activated");
  if (ui == null && !beforeQuit) {
    createWindow(logger.transports[0].level);
  }
});
