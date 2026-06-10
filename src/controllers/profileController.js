'use strict';

const profileService = require('../services/profileService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * HTTP layer. Translates requests into service calls and shapes the JSON
 * response. No business logic or SQL lives here.
 */

/** Clamps a user-supplied pagination value into a sane range. */
function parsePositiveInt(value, fallback, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

/**
 * POST /api/profiles
 * Body: { "username": "octocat" }
 * Fetches the profile from GitHub, computes & stores insights, returns them.
 */
const analyzeProfile = asyncHandler(async (req, res) => {
  const { username } = req.body || {};
  const profile = await profileService.analyzeAndStore(username);
  res.status(201).json({
    success: true,
    message: `Profile "${profile.username}" analyzed and stored.`,
    data: profile,
  });
});

/**
 * GET /api/profiles?limit=&offset=
 * Returns all stored analyzed profiles (paginated, newest first).
 */
const listProfiles = asyncHandler(async (req, res) => {
  const limit = parsePositiveInt(req.query.limit, 50, 100);
  const offset = parsePositiveInt(req.query.offset, 0);

  const { profiles, total } = await profileService.listProfiles({ limit, offset });
  res.json({
    success: true,
    pagination: { total, limit, offset, count: profiles.length },
    data: profiles,
  });
});

/**
 * GET /api/profiles/:username
 * Returns the stored insights for a single previously-analyzed profile.
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.getProfile(req.params.username);
  res.json({ success: true, data: profile });
});

/**
 * DELETE /api/profiles/:username
 * Removes a stored profile.
 */
const deleteProfile = asyncHandler(async (req, res) => {
  await profileService.removeProfile(req.params.username);
  res.json({
    success: true,
    message: `Profile "${req.params.username}" deleted.`,
  });
});

module.exports = {
  analyzeProfile,
  listProfiles,
  getProfile,
  deleteProfile,
};
