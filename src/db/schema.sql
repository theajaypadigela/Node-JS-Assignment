-- Schema for the GitHub Profile Analyzer.
--
-- One row per analyzed GitHub user. Re-analyzing a user updates the same row
-- (upsert on the unique `username`), so the table always holds the latest
-- snapshot of insights for each profile.

CREATE TABLE IF NOT EXISTS profiles (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- ----- Identity (from GitHub /users/{username}) -----
  github_id                BIGINT UNSIGNED NOT NULL,
  username                 VARCHAR(255) NOT NULL,
  name                     VARCHAR(255) NULL,
  avatar_url               VARCHAR(512) NULL,
  html_url                 VARCHAR(512) NULL,
  bio                      TEXT NULL,
  company                  VARCHAR(255) NULL,
  location                 VARCHAR(255) NULL,
  blog                     VARCHAR(512) NULL,
  email                    VARCHAR(255) NULL,
  hireable                 TINYINT(1) NULL,

  -- ----- Raw counts (from GitHub) -----
  public_repos             INT UNSIGNED NOT NULL DEFAULT 0,
  public_gists             INT UNSIGNED NOT NULL DEFAULT 0,
  followers                INT UNSIGNED NOT NULL DEFAULT 0,
  following                INT UNSIGNED NOT NULL DEFAULT 0,

  -- ----- Derived insights (computed by this service) -----
  total_stars              INT UNSIGNED NOT NULL DEFAULT 0,
  total_forks              INT UNSIGNED NOT NULL DEFAULT 0,
  total_watchers           INT UNSIGNED NOT NULL DEFAULT 0,
  total_open_issues        INT UNSIGNED NOT NULL DEFAULT 0,
  repos_analyzed           INT UNSIGNED NOT NULL DEFAULT 0,
  most_starred_repo        VARCHAR(255) NULL,
  most_starred_repo_stars  INT UNSIGNED NOT NULL DEFAULT 0,
  top_languages            JSON NULL,
  follower_following_ratio DECIMAL(10,2) NULL,
  account_age_days         INT UNSIGNED NULL,

  -- ----- Timestamps -----
  github_created_at        DATETIME NULL,
  github_updated_at        DATETIME NULL,
  analyzed_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_username (username),
  KEY idx_followers (followers),
  KEY idx_analyzed_at (analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
