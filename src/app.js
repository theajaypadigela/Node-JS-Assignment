'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const profileRoutes = require('./routes/profileRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Builds and configures the Express application. Exported without calling
 * listen() so it can be imported by tests and by server.js separately.
 */
function createApp() {
  const app = express();

  // ----- Security & parsing middleware -----
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ----- Health check -----
  app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', uptime: process.uptime() });
  });

  // ----- Root: tiny API map for discoverability -----
  app.get('/', (req, res) => {
    res.json({
      success: true,
      service: 'GitHub Profile Analyzer API',
      endpoints: {
        'POST /api/profiles': 'Analyze a GitHub username and store insights. Body: { "username": "octocat" }',
        'GET /api/profiles': 'List all stored profiles (query: limit, offset)',
        'GET /api/profiles/:username': 'Get a single stored profile',
        'DELETE /api/profiles/:username': 'Delete a stored profile',
        'GET /health': 'Health check',
      },
    });
  });

  // ----- Resource routes -----
  app.use('/api/profiles', profileRoutes);

  // ----- Fallbacks -----
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
