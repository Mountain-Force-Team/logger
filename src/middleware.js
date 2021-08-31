import Random from "@reactioncommerce/random";

export default function ({ route = "graphql", stage = "first" } = {}) {
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
          { ...meta, responseTime, body: { variables } },
          `${operationName} - ${res.statusCode} ${responseTime.toFixed(0)}ms`
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
}
