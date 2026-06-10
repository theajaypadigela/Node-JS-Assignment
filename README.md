# GitHub Profile Analyzer API

A backend service that analyzes a public GitHub user profile via the **GitHub public REST API**, computes useful insights, and stores them in **MySQL**. Built with **Node.js + Express.js**.

Given a GitHub username, the service fetches the profile and its public repositories, derives insights (total stars, top languages, follower/following ratio, account age, and more), persists a snapshot to MySQL, and exposes REST endpoints to list and retrieve stored analyses.

---

## Tech Stack

| Concern        | Choice                                    |
| -------------- | ----------------------------------------- |
| Runtime        | Node.js (>= 18, uses the built-in `fetch`) |
| Web framework  | Express.js                                |
| Database       | MySQL 8/9 via `mysql2` (connection pool)  |
| Third-party API| GitHub REST API v2022-11-28               |
| Security/Infra | helmet, cors, morgan, dotenv              |

---

## Architecture

A clean, layered structure — each layer has one responsibility and is independently testable:

```
server.js                 # Entry point: DB check, start HTTP, graceful shutdown
src/
├── app.js                # Express app assembly (middleware, routes, error handling)
├── config/
│   ├── env.js            # Validated config from environment variables
│   └── db.js             # MySQL connection pool + health check
├── db/
│   ├── schema.sql        # Table definition
│   └── migrate.js        # Idempotent migration runner
├── routes/
│   └── profileRoutes.js  # Route → controller mapping
├── controllers/
│   └── profileController.js   # HTTP request/response shaping
├── services/
│   ├── githubService.js  # GitHub API client + insight computation
│   └── profileService.js # Business logic / orchestration + validation
├── repositories/
│   └── profileRepository.js   # All SQL (parameterised)
├── middleware/
│   └── errorHandler.js   # 404 + central JSON error handler
└── utils/
    ├── ApiError.js       # Typed operational errors with HTTP status
    ├── asyncHandler.js   # Async route wrapper
    └── logger.js         # Timestamped logger
```

**Request flow:** `route → controller → service → (githubService + repository) → MySQL`

---

## Insights Stored

For every analyzed profile the service stores both the raw GitHub fields and derived insights:

**From the GitHub profile:** `github_id`, `username`, `name`, `avatar_url`, `html_url`, `bio`, `company`, `location`, `blog`, `email`, `hireable`, `public_repos`, `public_gists`, `followers`, `following`, `github_created_at`, `github_updated_at`.

**Computed by this service (by scanning the user's repos):**

| Insight                    | Meaning                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `total_stars`              | Sum of stargazers across the user's public repos              |
| `total_forks`              | Sum of forks across repos                                     |
| `total_watchers`           | Sum of watchers across repos                                  |
| `total_open_issues`        | Sum of open issues across repos                               |
| `repos_analyzed`           | How many repos were scanned for the above                     |
| `most_starred_repo` (+`_stars`) | The user's most popular repository and its star count    |
| `top_languages`            | Ranked top 5 languages by number of repos (JSON array)        |
| `follower_following_ratio` | followers ÷ following — a rough influence signal              |
| `account_age_days`         | Days since the account was created                            |
| `analyzed_at`              | When this snapshot was taken                                  |

---

## Prerequisites

- **Node.js >= 18** (uses the global `fetch`)
- **MySQL** running locally (or anywhere reachable)

This project was set up against a local Homebrew MySQL:

```bash
brew install mysql
brew services start mysql
# Create the database (root has no password on a fresh Homebrew install):
mysql -u root -e "CREATE DATABASE IF NOT EXISTS github_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   Edit .env if your MySQL credentials differ.
#   (Optional but recommended) add a GITHUB_TOKEN to raise the API rate limit.

# 3. Create the table
npm run migrate

# 4. Start the server
npm start          # production-style
# or
npm run dev        # auto-reload via nodemon
```

The server boots on `http://localhost:3000` by default (configurable via `PORT` in `.env`). It verifies the MySQL connection on startup and exits with a clear message if the DB is unreachable.

> **Note:** On the machine this was set up on, port 3000 was already in use, so the committed `.env` uses `PORT=4000`. Change it back to `3000` (or any free port) as you like — the examples below use 4000.

### GitHub rate limits

Without a token the GitHub API allows **60 requests/hour per IP**. Analyzing one profile uses a few requests (1 for the profile + 1 per 100 repos). Add a token to `.env` to get **5,000 requests/hour**:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

No scopes are required to read public data — create a token at <https://github.com/settings/tokens>.

---

## API Reference

Base URL: `http://localhost:4000` (or `:3000` if you reset `PORT`)

All responses are JSON with a consistent envelope:
`{ "success": true|false, ... }`. Errors return
`{ "success": false, "error": { "message": "..." } }`.

### `POST /api/profiles` — Analyze & store a profile

Fetches the profile from GitHub, computes insights, and stores (or refreshes) them.

**Request body**

```json
{ "username": "octocat" }
```

**Response** `201 Created`

```json
{
  "success": true,
  "message": "Profile \"octocat\" analyzed and stored.",
  "data": {
    "id": 1,
    "github_id": 583231,
    "username": "octocat",
    "name": "The Octocat",
    "followers": 18000,
    "following": 9,
    "public_repos": 8,
    "total_stars": 1234,
    "most_starred_repo": "Hello-World",
    "top_languages": [{ "language": "JavaScript", "repos": 3 }],
    "follower_following_ratio": 2000.0,
    "account_age_days": 5400,
    "analyzed_at": "2026-06-10 12:00:00"
  }
}
```

Errors: `400` (missing/invalid username), `404` (no such GitHub user), `429` (GitHub rate limit), `502` (GitHub unreachable).

### `GET /api/profiles` — List all stored profiles

Query params: `limit` (default 50, max 100), `offset` (default 0). Newest first.

```json
{
  "success": true,
  "pagination": { "total": 3, "limit": 50, "offset": 0, "count": 3 },
  "data": [ { "username": "octocat", "...": "summary fields" } ]
}
```

### `GET /api/profiles/:username` — Get one stored profile

Returns the full stored record. `404` if the profile has not been analyzed yet.

### `DELETE /api/profiles/:username` — Delete a stored profile

`404` if it does not exist.

### `GET /health` — Health check

```json
{ "success": true, "status": "ok", "uptime": 12.34 }
```

---

## Example Usage (curl)

```bash
# Analyze a profile
curl -X POST http://localhost:4000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"username":"torvalds"}'

# List stored profiles
curl http://localhost:4000/api/profiles

# Fetch one
curl http://localhost:4000/api/profiles/torvalds

# Delete one
curl -X DELETE http://localhost:4000/api/profiles/torvalds
```

---

## Design Notes & Decisions

- **Layered architecture** keeps HTTP, business logic, GitHub access, and SQL separate — easy to test and extend.
- **Upsert on `username`** means re-analyzing a user refreshes their snapshot rather than creating duplicates; `analyzed_at` reflects the latest run.
- **Connection pooling** (`mysql2`) for low-latency, safe concurrent access.
- **Parameterised queries** everywhere — no string-concatenated SQL — to prevent injection.
- **Fail-fast startup**: the process verifies MySQL connectivity before serving traffic.
- **Centralised error handling** with typed `ApiError`s yields consistent status codes and JSON shapes.
- **Graceful shutdown** drains the HTTP server and closes the DB pool on `SIGINT`/`SIGTERM`.
- **Username validation** mirrors GitHub's own rules, avoiding wasted upstream calls.

## Possible Future Improvements

- Caching / TTL so repeat analyses within N minutes serve from MySQL instead of re-hitting GitHub.
- Background job queue for analyzing users with thousands of repos.
- Automated tests (Jest + supertest) — the layering already supports this.
- Authentication / API keys for the service itself.
- Store a full repo breakdown in a related `repositories` table for richer querying.
