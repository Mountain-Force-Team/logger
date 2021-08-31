import Bunyan from "bunyan";
import BunyanFormat from "bunyan-format";
import Random from "@reactioncommerce/random";

import Bunyan2Loggly from "./loggly";
import { getLogDNAStream } from "./logdna";

// configure bunyan logging module for reaction server
// See: https://github.com/trentm/node-bunyan#levels
const levels = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

// set stdout log level
let level = process.env.REACTION_LOG_LEVEL || "INFO";

// allow overriding the stdout log formatting
// available options: short|long|simple|json|bunyan
// https://www.npmjs.com/package/bunyan-format
const outputMode = process.env.REACTION_LOG_FORMAT || "short";

level = level.toUpperCase();

if (!levels.includes(level)) {
  level = "INFO";
}

// default console config (stdout)
const streams = [
  {
    level,
    stream: BunyanFormat({ outputMode }),
  },
];

// Loggly config (only used if configured)
const logglyToken = process.env.LOGGLY_TOKEN;
const logglySubdomain = process.env.LOGGLY_SUBDOMAIN;

if (logglyToken && logglySubdomain) {
  const logglyStream = {
    type: "raw",
    level: process.env.LOGGLY_LOG_LEVEL || "DEBUG",
    stream: new Bunyan2Loggly(
      {
        token: logglyToken,
        subdomain: logglySubdomain,
      },
      process.env.LOGGLY_BUFFER_LENGTH || 1
    ),
  };
  streams.push(logglyStream);
}

// LogDNA
const logDnaApiKey = process.env.LOGDNA_API_KEY;
const logDnaAppName = process.env.LOGDNA_APP_NAME;
const logDnaHostname = process.env.LOGDNA_HOSTNAME;

if (logDnaApiKey) {
  const logDNAStream = getLogDNAStream({
    key: logDnaApiKey,
    app: logDnaAppName,
    hostname: logDnaHostname,
  });
  streams.push(logDNAStream);
}

// create default logger instance
const Logger = Bunyan.createLogger({
  name: process.env.REACTION_LOGGER_NAME || "Reaction",
  level,
  streams,
});

// Export bunyan so users can create their own loggers from scratch if needed.
// In order to be compatible with Node ES modules, we can't have named CommonJS
// exports, so we set these as properties of the default export instead.
Logger.bunyan = Bunyan;
Logger.bunyanFormat = BunyanFormat;

Logger.LoggerMiddleware = function ({
  route = "graphql",
  stage = "first",
} = {}) {
  const middlewareFunction = (context) => {
    return (req, res, next) => {
      const { body } = req;
      const { variables, operationName } = body || {};

      const reqId = Random.id();
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const lang = req.headers["languages"];

      const meta = {
        reqId,
        ip,
        lang,
      };

      const startTime = new Date().getTime();
      function afterResponse() {
        res.removeListener("finish", afterResponse);
        res.removeListener("close", afterResponse);

        const responseTime = new Date().getTime() - startTime;

        Logger.info(
          `${operationName} - ${res.statusCode} ${responseTime.toFixed(0)}ms`,
          { ...meta, responseTime, body: { variables } }
        );
      }

      res.on("finish", afterResponse);
      res.on("close", afterResponse);

      next();
    };
  };

  return {
    route,
    stage,
    fn: middlewareFunction,
  };
};

export default Logger;
