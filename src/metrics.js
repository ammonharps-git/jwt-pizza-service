const os = require("os");
const config = require("./config");

// TODO add endpoint names to all the methods in service.js or the routers that you want to track.
// That will let grafana see and track them.

const requests = {};

function sendMetricToGrafana(metricName, metricValue, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push(
      {
        key: key,
        value: { stringValue: attributes[key] },
      }
    );
  });

  const body = JSON.stringify(metric);
  fetch(`${config.metrics.url}`, {
    method: "POST",
    body: body,
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(
            `Failed to push metrics data to Grafana: ${text}\n${body}`
          );
        });
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

// Collect and send system metrics
function systemMetrics() {
  const cpuUsage = (os.loadavg()[0] / os.cpus().length) * 100;
  const memoryUsage = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;

  sendMetricToGrafana("cpu_usage", cpuUsage.toFixed(0), {});
  sendMetricToGrafana("memory_usage", memoryUsage.toFixed(0), {});

  console.log("Sent system metrics!"); // testing
}

// Collect and send HTTP request metrics
function requestMetrics(req) {
  const method = req.method;
  const statusCode = req.statusCode;

  requests[method] = (requests[method] || 0) + 1;

  sendMetricToGrafana("http_request_total", requests[method], {
    status: statusCode.toString(),
    method: method,
  });
}

// Collect and send request latency metrics
function latencyMetrics({ duration }) {
  // builder.addMetric("latency_ms", duration, { endpoint });
  sendMetricToGrafana("request_latency", duration, {});
}

// Collect and send request latency metrics
function pizzaLatency(duration) {
  // builder.addMetric("latency_ms", duration, { endpoint });
  sendMetricToGrafana("pizza_latency", duration, {});
}

let pizzasSold = 0;
function sellPizza() {
  pizzasSold += 1;
  sendMetricToGrafana("pizzas_sold", pizzasSold, {});
}

let creationsFailed = 0;
function failCreation() {
  creationsFailed += 1;
  sendMetricToGrafana("creations_failed", creationsFailed, {});
}

let revenue = 0;
function addRevenue(added_revenue) {
  revenue += added_revenue;
  sendMetricToGrafana("revenue", revenue, {});
}

// middleware to track request metrics
function requestTracker(req, res, next) {
  const start = Date.now();

  // Once the response is finished, track the request
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;

    // Track the HTTP request metric
    requestMetrics({ method, statusCode });

    // Optionally log latency if needed
    latencyMetrics({ duration });
  });

  next();
}

let active_users = 0;
// Collect and send user metrics (active users)
function userMetrics(num_users_change) {
  active_users += num_users_change;
  sendMetricToGrafana("active_users", active_users, {});
}

// Collect and send authentication attempt metrics
function authMetrics(isSuccessful) {
  console.log("> auth called"); // testing
  requests["auth"] = (requests["auth"] || 0) + 1;
  sendMetricToGrafana("auth_attmepts", requests["auth"], {
    success: isSuccessful.toString(),
  });
}

// Periodic reporting
function sendMetricsPeriodically(interval) {
  setInterval(() => {
    try {
      systemMetrics();
      // TODO add more metrics collection functions here (e.g., pizza metrics, auth metrics, etc.)
      Object.keys(requests).forEach((endpoint) => {
        sendMetricToGrafana("requests", requests[endpoint], { endpoint });
      });
    } catch (error) {
      console.log("Error sending metrics:", error);
    }
  }, interval); // Send metrics every minute
}

module.exports = {
  sendMetricsPeriodically,
  requestTracker,
  requestMetrics,
  authMetrics,
  userMetrics,
  latencyMetrics,
  pizzaLatency,
  sellPizza,
  addRevenue,
  failCreation,
};
