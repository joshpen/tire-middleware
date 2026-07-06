import cron from "node-cron";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { pollAllEndpoints } from "./files/poller.js";
import { processOutbox } from "./hub/outbox.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const db = createDb(config);
const app = buildServer(config, db);

let polling = false;
async function runPollCycle() {
  if (polling) {
    app.log.warn("poll cycle skipped: previous cycle still running");
    return;
  }
  polling = true;
  try {
    const outcomes = await pollAllEndpoints(db);
    for (const o of outcomes) {
      app.log.info(
        { endpointId: o.endpointId, status: o.status, files: o.filesSeen, records: o.recordsProcessed },
        "file endpoint polled",
      );
    }
    const delivered = await processOutbox(db);
    if (Object.keys(delivered).length) app.log.info(delivered, "hub outbox processed");
  } catch (err) {
    app.log.error({ err }, "poll cycle failed");
  } finally {
    polling = false;
  }
}

if (config.pollCron) {
  cron.schedule(config.pollCron, runPollCycle);
  app.log.info({ cron: config.pollCron }, "file endpoint polling scheduled");
}

app
  .listen({ port: config.port, host: config.host })
  .then(() => app.log.info("tread-sync-gateway listening"))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
