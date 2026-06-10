'use strict';

const mysql = require('mysql2/promise');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * A single shared connection pool for the whole process. Using a pool (rather
 * than per-request connections) keeps latency low and protects MySQL from
 * connection exhaustion under load.
 */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  // Decode DATETIME columns as JS strings to avoid timezone surprises; we
  // store and return ISO-ish strings consistently.
  dateStrings: true,
  // Return DECIMAL columns (e.g. follower_following_ratio) as JS numbers
  // rather than strings.
  decimalNumbers: true,
});

/**
 * Verifies the pool can reach MySQL. Called on boot so the process fails fast
 * with a clear message instead of erroring on the first request.
 */
async function assertConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    logger.info(
      `Connected to MySQL at ${config.db.host}:${config.db.port}/${config.db.database}`
    );
  } finally {
    connection.release();
  }
}

async function closePool() {
  await pool.end();
  logger.info('MySQL connection pool closed');
}

module.exports = { pool, assertConnection, closePool };
