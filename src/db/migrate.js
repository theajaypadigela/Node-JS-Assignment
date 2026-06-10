'use strict';

/**
 * Idempotent migration runner. Executes every statement in schema.sql so the
 * database is ready before the server starts. Safe to run repeatedly thanks to
 * the `CREATE TABLE IF NOT EXISTS` guard.
 *
 * Usage: `npm run migrate`
 */
const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('../config/db');
const logger = require('../utils/logger');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const raw = fs.readFileSync(schemaPath, 'utf8');

  // Strip full-line `--` comments first so they don't get mistaken for (or
  // attached to) SQL statements, then split on semicolons. The
  // `multipleStatements` pool option is intentionally left off (safer default),
  // so we execute each statement separately.
  const sql = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }

  logger.info(`Migration complete (${statements.length} statement(s) applied)`);
}

migrate()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration failed:', err.message);
    process.exit(1);
  });
