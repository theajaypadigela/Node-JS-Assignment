'use strict';

const githubService = require('./githubService');
const profileRepository = require('../repositories/profileRepository');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Application/business layer. Coordinates the GitHub client and the repository,
 * and is the single place controllers call into. Keeps HTTP concerns out
 * (no req/res here) so the logic stays reusable and testable.
 */

// GitHub usernames: 1-39 chars, alphanumeric or single hyphens (not leading/
// trailing). We validate here so we never make a pointless upstream call.
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function assertValidUsername(username) {
  if (typeof username !== 'string' || username.trim() === '') {
    throw ApiError.badRequest('A non-empty "username" is required.');
  }
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    throw ApiError.badRequest(
      'Invalid GitHub username. Use 1-39 alphanumeric characters or hyphens.'
    );
  }
  return trimmed;
}

/**
 * Fetches a profile from GitHub, computes insights, and persists them.
 * Re-analyzing an existing user refreshes the stored snapshot.
 */
async function analyzeAndStore(username) {
  const clean = assertValidUsername(username);
  logger.info(`Analyzing GitHub profile: ${clean}`);

  const insights = await githubService.analyzeProfile(clean);
  const stored = await profileRepository.upsert(insights);

  logger.info(
    `Stored insights for ${stored.username} ` +
      `(repos=${stored.public_repos}, followers=${stored.followers}, stars=${stored.total_stars})`
  );
  return stored;
}

/** Returns a page of stored profiles plus pagination metadata. */
async function listProfiles({ limit, offset }) {
  const [profiles, total] = await Promise.all([
    profileRepository.findAll({ limit, offset }),
    profileRepository.count(),
  ]);
  return { profiles, total };
}

/** Returns a single stored profile or throws 404 if it has not been analyzed. */
async function getProfile(username) {
  const clean = assertValidUsername(username);
  const profile = await profileRepository.findByUsername(clean);
  if (!profile) {
    throw ApiError.notFound(
      `No stored analysis for "${clean}". Analyze it first via POST /api/profiles.`
    );
  }
  return profile;
}

/** Deletes a stored profile or throws 404 if it does not exist. */
async function removeProfile(username) {
  const clean = assertValidUsername(username);
  const deleted = await profileRepository.deleteByUsername(clean);
  if (!deleted) {
    throw ApiError.notFound(`No stored analysis for "${clean}".`);
  }
}

module.exports = {
  analyzeAndStore,
  listProfiles,
  getProfile,
  removeProfile,
};
