'use strict';

const createApp = require('./src/app');
const config = require('./src/config/env');
const { assertConnection, closePool } = require('./src/config/db');
const logger = require('./src/utils/logger');

/**
 * Process entry point. Verifies the database is reachable before binding the
 * HTTP port (fail fast), then starts the server and wires up graceful shutdown.
 */
async function start() {
  try {
    await assertConnection();
  } catch (err) {
    logger.error('Could not connect to MySQL. Is it running and is .env correct?');
    logger.error(err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`GitHub Profile Analyzer API listening on http://localhost:${config.port} (${config.env})`);
    if (!config.github.token) {
      logger.warn('No GITHUB_TOKEN set — GitHub API limited to 60 requests/hour. See .env.example.');
    }
  });

  // ----- Graceful shutdown -----
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully.`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain within 10s.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
}

start();
