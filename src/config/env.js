'use strict';

require('dotenv').config();

/**
 * Centralised, validated configuration loaded from environment variables.
 * Importing this module guarantees the rest of the app reads a single,
 * type-coerced source of truth instead of touching process.env directly.
 */
const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'github_analyzer',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    baseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
    maxRepos: toInt(process.env.GITHUB_MAX_REPOS, 300),
  },
};

module.exports = config;
