const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLogger, transports, format, config } = require("winston");

const LOG_FILE = "client.log";
const DIST_CLIENT_LOG_FOLDER_UNIX = path.join(os.homedir(), ".bitcoin-explorer-app");
const DIST_CLIENT_LOG_FOLDER_WIN = path.join(os.homedir(), "bitcoin-explorer-app");

const { combine, timestamp, printf } = format;

const loggingFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level.toUpperCase()}:[-] ${message}`;
});

const logger = function(logLevel="info", distsAvailable=false) {

  let logPath;
  if (!distsAvailable) {
    logPath = 'client.log';
  }
  else {
    switch (process.platform) {
      case "darwin":
      case "linux":
        if (fs.existsSync(DIST_CLIENT_LOG_FOLDER_UNIX)) {
          logPath = path.join(DIST_CLIENT_LOG_FOLDER_UNIX, LOG_FILE);
        }
        else {
          fs.mkdirSync(DIST_CLIENT_LOG_FOLDER_UNIX, 0744);
          logPath = path.join(DIST_CLIENT_LOG_FOLDER_UNIX, LOG_FILE);
        }
        break;
      case "win32":
        if (fs.existsSync(DIST_CLIENT_LOG_FOLDER_WIN)) {
          logPath = path.join(DIST_CLIENT_LOG_FOLDER_WIN, LOG_FILE);
        }
        else {
          fs.mkdirSync(DIST_CLIENT_LOG_FOLDER_WIN, 0744);
          logPath = path.join(DIST_CLIENT_LOG_FOLDER_WIN, LOG_FILE);
        }
        break;
      default:
        logPath = 'client.log'
        break;
    }
  }
  console.log(`Client log path: ${logPath}`);
  return createLogger({
    level: config.syslog.levels,
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      loggingFormat
    ),
    defaultMeta: { service: 'bitcoin-explorer' },
    transports: [
      new transports.File({
        level: logLevel,
        filename: logPath,
        options: { flags: 'w' },
        name: 'client'
      })
    ]
  });
};

module.exports = logger;
