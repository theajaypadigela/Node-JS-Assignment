'use strict';

const express = require('express');
const controller = require('../controllers/profileController');

const router = express.Router();

/**
 * Routes for the profile resource. Mounted at /api/profiles by the app.
 *
 *   POST   /api/profiles            -> analyze a username & store insights
 *   GET    /api/profiles            -> list all stored profiles (paginated)
 *   GET    /api/profiles/:username  -> fetch one stored profile
 *   DELETE /api/profiles/:username  -> delete one stored profile
 */
router.post('/', controller.analyzeProfile);
router.get('/', controller.listProfiles);
router.get('/:username', controller.getProfile);
router.delete('/:username', controller.deleteProfile);

module.exports = router;
