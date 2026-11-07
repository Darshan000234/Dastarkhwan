import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`Dastarkhwan API listening on http://localhost:${env.port}`);
  console.log(`API base URL: http://localhost:${env.port}${env.apiPrefix}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing HTTP server...`);
  server.close((error) => {
    if (error) {
      console.error('Error while closing server:', error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
