import LogDNAStream from "logdna-bunyan";

export const getLogDNAStream = ({ key, app, hostname }) => {
  const logDNA = new LogDNAStream({
    key,
    app,
    hostname,
  });

  return {
    stream: logDNA,
    type: "raw",
    reemitErrorEvents: true,
  };
};
