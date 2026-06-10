'use strict';

const { pool } = require('../config/db');

/**
 * Data-access layer for the `profiles` table. All SQL lives here; the rest of
 * the app deals in plain objects. Every query is parameterised to prevent SQL
 * injection.
 */

// Columns we write on insert/update. Kept in one place so insert + update stay
// in sync as the schema grows.
const WRITABLE_COLUMNS = [
  'github_id',
  'username',
  'name',
  'avatar_url',
  'html_url',
  'bio',
  'company',
  'location',
  'blog',
  'email',
  'hireable',
  'public_repos',
  'public_gists',
  'followers',
  'following',
  'total_stars',
  'total_forks',
  'total_watchers',
  'total_open_issues',
  'repos_analyzed',
  'most_starred_repo',
  'most_starred_repo_stars',
  'top_languages',
  'follower_following_ratio',
  'account_age_days',
  'github_created_at',
  'github_updated_at',
];

/** JSON columns need to be stringified before being handed to MySQL. */
function serialiseRow(profile) {
  return WRITABLE_COLUMNS.map((col) => {
    const value = profile[col];
    if (col === 'top_languages' && value !== null && value !== undefined) {
      return JSON.stringify(value);
    }
    return value === undefined ? null : value;
  });
}

/**
 * Inserts a new profile or updates the existing one (matched on the unique
 * `username`). Returns the freshly persisted row.
 */
async function upsert(profile) {
  const columns = WRITABLE_COLUMNS.join(', ');
  const placeholders = WRITABLE_COLUMNS.map(() => '?').join(', ');
  // On conflict, refresh every writable column. `analyzed_at`/`updated_at` are
  // handled by the schema defaults / ON UPDATE clause.
  const updates = WRITABLE_COLUMNS.filter((c) => c !== 'username' && c !== 'github_id')
    .map((c) => `${c} = VALUES(${c})`)
    .join(', ');

  const sql =
    `INSERT INTO profiles (${columns}) VALUES (${placeholders}) ` +
    `ON DUPLICATE KEY UPDATE ${updates}, analyzed_at = CURRENT_TIMESTAMP`;

  await pool.query(sql, serialiseRow(profile));
  return findByUsername(profile.username);
}

/**
 * Returns a paginated list of stored profiles with the most useful summary
 * fields. Ordered by most recently analyzed first.
 */
async function findAll({ limit = 50, offset = 0 } = {}) {
  const [rows] = await pool.query(
    `SELECT id, github_id, username, name, avatar_url, html_url, bio, company,
            location, public_repos, followers, following, total_stars,
            total_forks, most_starred_repo, most_starred_repo_stars,
            top_languages, follower_following_ratio, account_age_days,
            analyzed_at, updated_at
       FROM profiles
       ORDER BY analyzed_at DESC
       LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

/** Total number of stored profiles (for pagination metadata). */
async function count() {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM profiles');
  return rows[0].total;
}

/** Returns the full row for a username, or null if it has not been analyzed. */
async function findByUsername(username) {
  const [rows] = await pool.query(
    'SELECT * FROM profiles WHERE username = ? LIMIT 1',
    [username]
  );
  return rows.length ? rows[0] : null;
}

/** Deletes a stored profile. Returns true if a row was removed. */
async function deleteByUsername(username) {
  const [result] = await pool.query(
    'DELETE FROM profiles WHERE username = ?',
    [username]
  );
  return result.affectedRows > 0;
}

module.exports = {
  upsert,
  findAll,
  count,
  findByUsername,
  deleteByUsername,
};
