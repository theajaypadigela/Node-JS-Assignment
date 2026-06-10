'use strict';

const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Thin client over the GitHub public REST API. Responsible only for talking to
 * GitHub and shaping the raw responses into the insights our service stores.
 * It does NOT touch the database — that separation keeps each layer testable.
 */

const DEFAULT_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'github-profile-analyzer',
};

function buildHeaders() {
  const headers = { ...DEFAULT_HEADERS };
  if (config.github.token) {
    headers.Authorization = `Bearer ${config.github.token}`;
  }
  return headers;
}

/**
 * Performs a single GET against the GitHub API and normalises common failure
 * modes into ApiErrors with sensible HTTP status codes.
 */
async function githubGet(pathname) {
  const url = `${config.github.baseUrl}${pathname}`;
  let response;
  try {
    response = await fetch(url, { headers: buildHeaders() });
  } catch (networkErr) {
    logger.error('GitHub request failed (network):', networkErr.message);
    throw ApiError.badGateway('Unable to reach the GitHub API. Please try again later.');
  }

  if (response.ok) {
    return response.json();
  }

  // Rate limiting: GitHub signals it via 403/429 + x-ratelimit-remaining: 0.
  const remaining = response.headers.get('x-ratelimit-remaining');
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetHint = resetHeader
      ? ` Limit resets at ${new Date(Number(resetHeader) * 1000).toISOString()}.`
      : '';
    throw ApiError.tooManyRequests(
      `GitHub API rate limit exceeded.${resetHint} Set GITHUB_TOKEN to raise the limit.`
    );
  }

  if (response.status === 404) {
    throw ApiError.notFound('GitHub user not found.');
  }

  const body = await response.text();
  logger.error(`GitHub API error ${response.status} for ${pathname}: ${body}`);
  throw ApiError.badGateway(`GitHub API returned an unexpected status (${response.status}).`);
}

/** Fetches the core public profile for a username. */
async function fetchUser(username) {
  return githubGet(`/users/${encodeURIComponent(username)}`);
}

/**
 * Fetches up to `config.github.maxRepos` public repositories, paginating the
 * /users/{username}/repos endpoint (100 per page is the GitHub max).
 */
async function fetchRepos(username) {
  const perPage = 100;
  const maxRepos = config.github.maxRepos;
  const repos = [];

  for (let page = 1; repos.length < maxRepos; page += 1) {
    const pathname =
      `/users/${encodeURIComponent(username)}/repos` +
      `?per_page=${perPage}&page=${page}&type=owner&sort=updated`;
    const batch = await githubGet(pathname);

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    repos.push(...batch);

    if (batch.length < perPage) {
      break; // Last page reached.
    }
  }

  return repos.slice(0, maxRepos);
}

/**
 * Reduces a list of repos into aggregate insights: total stars/forks, the most
 * starred repo, and a ranked breakdown of the languages the user works in.
 */
function summariseRepos(repos) {
  const summary = {
    total_stars: 0,
    total_forks: 0,
    total_watchers: 0,
    total_open_issues: 0,
    repos_analyzed: repos.length,
    most_starred_repo: null,
    most_starred_repo_stars: 0,
    top_languages: [],
  };

  const languageCounts = new Map();

  for (const repo of repos) {
    const stars = repo.stargazers_count || 0;
    summary.total_stars += stars;
    summary.total_forks += repo.forks_count || 0;
    summary.total_watchers += repo.watchers_count || 0;
    summary.total_open_issues += repo.open_issues_count || 0;

    if (stars > summary.most_starred_repo_stars) {
      summary.most_starred_repo_stars = stars;
      summary.most_starred_repo = repo.name;
    }

    if (repo.language) {
      languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1);
    }
  }

  // Rank languages by how many repos use them; cap at the top 5.
  summary.top_languages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, repos: count }));

  return summary;
}

/**
 * Orchestrates the full analysis for a username: fetches the profile and repos,
 * computes derived insights, and returns a single normalised object ready to be
 * persisted. This is the only function controllers/services need to call.
 */
async function analyzeProfile(username) {
  const user = await fetchUser(username);
  const repos = await fetchRepos(user.login);
  const repoSummary = summariseRepos(repos);

  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const accountAgeDays = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const followerFollowingRatio =
    user.following > 0
      ? Number((user.followers / user.following).toFixed(2))
      : user.followers; // If following 0, ratio is just the follower count.

  return {
    github_id: user.id,
    username: user.login,
    name: user.name || null,
    avatar_url: user.avatar_url || null,
    html_url: user.html_url || null,
    bio: user.bio || null,
    company: user.company || null,
    location: user.location || null,
    blog: user.blog || null,
    email: user.email || null,
    hireable: user.hireable === null || user.hireable === undefined ? null : Boolean(user.hireable),

    public_repos: user.public_repos || 0,
    public_gists: user.public_gists || 0,
    followers: user.followers || 0,
    following: user.following || 0,

    total_stars: repoSummary.total_stars,
    total_forks: repoSummary.total_forks,
    total_watchers: repoSummary.total_watchers,
    total_open_issues: repoSummary.total_open_issues,
    repos_analyzed: repoSummary.repos_analyzed,
    most_starred_repo: repoSummary.most_starred_repo,
    most_starred_repo_stars: repoSummary.most_starred_repo_stars,
    top_languages: repoSummary.top_languages,
    follower_following_ratio: followerFollowingRatio,
    account_age_days: accountAgeDays,

    github_created_at: user.created_at ? toMysqlDateTime(user.created_at) : null,
    github_updated_at: user.updated_at ? toMysqlDateTime(user.updated_at) : null,
  };
}

/** Converts an ISO-8601 string (e.g. "2011-01-25T18:44:36Z") to MySQL DATETIME. */
function toMysqlDateTime(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  analyzeProfile,
  // Exported for unit testing in isolation.
  summariseRepos,
  fetchUser,
  fetchRepos,
};
