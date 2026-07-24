# Environment Variable Reference

This document describes every environment variable required or supported by the US Business Lead SaaS platform.

Copy `.env.example` to `.env` for local development. **Never commit `.env` to version control.**

---

## Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Runtime environment (`development`, `production`, `test`) |
| `API_PORT` | No | `5000` | TCP port for the Express API server |
| `WEB_PORT` | No | `5173` | TCP port for the Vite frontend dev server |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Allowed CORS origin for browser requests |
| `LOG_LEVEL` | No | `info` | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |

---

## Database (PostgreSQL)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full PostgreSQL connection URL, e.g. `postgresql://user:pass@host:5432/db?schema=public` |
| `DIRECT_DATABASE_URL` | Yes | Same as above — used by Prisma Migrate for direct connections bypassing PgBouncer |
| `POSTGRES_HOST_PORT` | No | Host port mapping for Docker Compose (default `5432`) |

---

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | Yes | `localhost` | Redis server hostname |
| `REDIS_PORT` | Yes | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis AUTH password (leave empty if no auth) |
| `REDIS_USERNAME` | No | — | Redis ACL username (Redis 6+) |
| `REDIS_DB` | No | `0` | Redis logical database index |
| `REDIS_MAX_RETRIES_PER_REQUEST` | No | `3` | Max retry attempts per command |
| `REDIS_HOST_PORT` | No | `6379` | Host port mapping for Docker Compose |

---

## Queue (BullMQ)

| Variable | Required | Default | Description |
|---|---|---|---|
| `QUEUE_PREFIX` | No | `lead-saas` | BullMQ key prefix in Redis |
| `SCRAPING_QUEUE_NAME` | No | `scraping-jobs` | Name of the scraping job queue |
| `CSV_IMPORT_QUEUE_NAME` | No | `csv-imports` | Name of the CSV import queue |
| `WORKER_CONCURRENCY` | No | `2` | Number of concurrent worker jobs |

---

## JWT & Authentication

| Variable | Required | Description |
|---|---|---|
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens — minimum 64 random bytes |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens — minimum 64 random bytes |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token lifetime, e.g. `15m` (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token lifetime, e.g. `7d` (default: `7d`) |

Generate secrets with: `openssl rand -base64 64`

---

## Auth Cookie

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH_COOKIE_NAME` | No | `lead_saas_refresh_token` | Name of the HttpOnly refresh token cookie |
| `AUTH_COOKIE_SECURE` | No | `false` | Set `true` in production to require HTTPS |
| `AUTH_COOKIE_SAME_SITE` | No | `lax` | SameSite policy: `strict`, `lax`, or `none` |
| `AUTH_COOKIE_DOMAIN` | No | — | Cookie domain scope (leave empty for default) |
| `AUTH_COOKIE_PATH` | No | `/api/v1/auth` | Restrict cookie to auth routes only |

---

## Auth Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Rate limit window for login endpoint |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | Max login attempts per window |
| `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS` | `3600000` (60 min) | Rate limit window for registration |
| `AUTH_REGISTER_RATE_LIMIT_MAX` | `5` | Max registration attempts per window |
| `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Rate limit window for token refresh |
| `AUTH_REFRESH_RATE_LIMIT_MAX` | `30` | Max refresh requests per window |

---

## Resource Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `CSV_IMPORT_RATE_LIMIT_WINDOW_MS` | `3600000` (60 min) | Window for CSV import rate limit |
| `CSV_IMPORT_RATE_LIMIT_MAX` | `10` | Max CSV imports per user per window |
| `LEAD_VERIFY_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Window for lead verification rate limit |
| `LEAD_VERIFY_RATE_LIMIT_MAX` | `20` | Max verifications per user per window |

---

## Data Ingestion Limits

| Variable | Default | Description |
|---|---|---|
| `CSV_IMPORT_MAX_FILE_BYTES` | `5242880` (5 MB) | Maximum allowed CSV file size |
| `CSV_IMPORT_MAX_ROWS` | `10000` | Maximum rows per CSV import |
| `CSV_IMPORT_BACKGROUND_THRESHOLD_ROWS` | `500` | Row count above which import is queued asynchronously |

---

## Scraping & Enrichment

| Variable | Default | Description |
|---|---|---|
| `SCRAPING_FIXTURE_SOURCE_ENABLED` | `false` | Enable mock fixture data source |
| `SCRAPING_EXTERNAL_SOURCE_ENABLED` | `false` | Enable real external sources |
| `SCRAPING_APPROVED_BASE_URL` | — | Base URL restriction for the HTTP scraper |
| `SCRAPING_USER_AGENT` | `LeadSaaSResearchBot/0.1` | User-agent sent with scraping requests |
| `SCRAPING_REQUEST_TIMEOUT_MS` | `10000` | Per-request HTTP timeout |
| `SCRAPING_MIN_DELAY_MS` | `1500` | Minimum delay between scraping requests |
| `SCRAPING_MAX_PAGES_PER_JOB` | `5` | Maximum pages fetched per scraping job |
| `WEBSITE_ENRICHMENT_MAX_PAGES` | `5` | Max pages crawled per website |
| `WEBSITE_ENRICHMENT_MAX_DEPTH` | `1` | Link depth for website crawl |
| `WEBSITE_ENRICHMENT_MAX_RESPONSE_BYTES` | `2097152` (2 MB) | Max bytes per page response |

---

## Third-Party API Credentials

| Variable | Description |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Google Places API key (leave empty to disable) |
| `GOOGLE_PLACES_REGION` | Two-letter region code (default `US`) |
| `GOOGLE_PLACES_LANGUAGE` | Language code (default `en`) |
| `GOOGLE_PLACES_REQUEST_TIMEOUT_MS` | Request timeout in ms (default `15000`) |
| `GOOGLE_PLACES_MAX_PAGES_PER_JOB` | Max pagination pages per job (default `1`) |
| `GOOGLE_PLACES_DEFAULT_RADIUS_METERS` | Search radius in meters (default `25000`) |
| `META_APPROVED_API_ACCESS_TOKEN` | Meta Business API access token |
| `YELP_APPROVED_API_KEY` | Yelp Fusion API key |
| `GOVERNMENT_DATASET_URL` | URL to a government open-data CSV dataset |

---

## Frontend (Vite)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL for API calls from the browser (e.g. `http://localhost:5000/api/v1`) |
| `VITE_APP_NAME` | Application display name shown in the UI |

---

## Test Database

The API test suite automatically derives a test database URL from `DATABASE_URL` by appending `_auth_test` to the database name. The `test/prepare-auth-test-database.ts` script:

1. Creates the `_auth_test` database if missing
2. Applies all Prisma migrations
3. Seeds the plan catalog

No manual setup is required — simply ensure the PostgreSQL credentials in `DATABASE_URL` have permission to create databases.
