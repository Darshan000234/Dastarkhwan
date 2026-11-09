import app from "./app.js";
import { env } from "./config/env.js";
import { createServer } from "node:http";
import { initializeRealtime, closeRealtime } from "./services/realtime.js";
const server = createServer(app);

initializeRealtime(server);

server.listen(env.port, () => {
  console.log(`Dastarkhwan API listening on http://localhost:${env.port}`);

  console.log(`API base URL: http://localhost:${env.port}${env.apiPrefix}`);

  console.log("Socket.IO server initialized.");
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  closeRealtime()
    .then(
      () =>
        new Promise((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    )
    .then(() => {
      console.log("HTTP and Socket.IO servers closed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Shutdown failed:", error);
      process.exit(1);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
