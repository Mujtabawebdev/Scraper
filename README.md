# US Business Lead SaaS

A production-oriented SaaS for collecting and managing publicly available U.S. business contact information from legitimate and permitted sources.

## Planned Stack

- **Frontend:** React.js, TypeScript, Vite, Tailwind CSS, Shadcn UI, Redux Toolkit, and TanStack Query.
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL, Prisma ORM, Redis, and BullMQ.
- **Scraping:** Cheerio and Playwright for permitted collection workflows.
- **Infrastructure:** Docker, Docker Compose, Nginx, and GitHub Actions.

## Monorepo Applications

- `apps/api`: Express REST API with configuration, logging, middleware, and health checks.
- `apps/worker`: Future background job worker.
- `apps/web`: Future React web application.
- `packages/shared-types`: Future shared TypeScript contracts.
- `packages/validation`: Future shared validation schemas.
- `packages/config`: Future shared configuration.

## Local Development

Node.js 20 or newer, Docker, and Docker Compose are required. PostgreSQL and Redis run locally through Compose. Create the ignored local environment file before starting services:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres redis
docker compose ps
```

```powershell
npm install
npm run prisma:generate --workspace=@lead-saas/api
npm run db:check --workspace=@lead-saas/api
npm run typecheck
npm run build
npm run dev:api
```

In a second terminal, start the BullMQ worker:

```powershell
npm run db:seed --workspace=@lead-saas/api
npm run dev:worker
```

The local worker concurrency is controlled by `WORKER_CONCURRENCY` and defaults to `2`.

The API runs at `http://localhost:5000`; health is at `http://localhost:5000/api/v1/health`. Copy `.env.example` to `.env` only when local overrides are needed. Never commit real secrets.

## Prisma And Migrations

```powershell
npm run prisma:format --workspace=@lead-saas/api
npm run prisma:validate --workspace=@lead-saas/api
npm run prisma:generate --workspace=@lead-saas/api
npm run db:migrate:dev --workspace=@lead-saas/api -- --name migration_name
npm run db:migrate:deploy --workspace=@lead-saas/api
npm run prisma:studio --workspace=@lead-saas/api
```

Use `prisma migrate dev` only in development. Production environments apply already reviewed migrations with `prisma migrate deploy`. Detailed architecture and workflow notes are in `docs/database.md`.

## Authentication

Phase 5 provides password authentication, short-lived bearer access tokens, rotating
refresh-token sessions, and role authorization under `/api/v1/auth`.

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Public | Create an active user and initial session |
| `POST` | `/api/v1/auth/login` | Public | Authenticate and create a new session |
| `POST` | `/api/v1/auth/refresh` | Refresh cookie | Rotate the session and issue a new access token |
| `POST` | `/api/v1/auth/logout` | Optional refresh cookie | Revoke the matching session and clear the cookie |
| `POST` | `/api/v1/auth/logout-all` | Bearer access token | Revoke every active session for the current user |
| `GET` | `/api/v1/auth/me` | Bearer access token | Return the current active user |

Registration:

```powershell
$registrationBody = @{
  fullName = "John Smith"
  email = "john.smith@example.com"
  password = "StrongPassword123!"
} | ConvertTo-Json

$registration = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/v1/auth/register `
  -ContentType "application/json" `
  -Body $registrationBody `
  -SessionVariable authSession
```

Login:

```powershell
$loginBody = @{
  email = "john.smith@example.com"
  password = "StrongPassword123!"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/v1/auth/login `
  -ContentType "application/json" `
  -Body $loginBody `
  -SessionVariable authSession
```

Registration and login return an access token in `data.accessToken`. They never
return the refresh token; the HTTP client receives it only as an `HttpOnly`
cookie. Use the access token as a bearer credential:

```powershell
$accessToken = $login.data.accessToken
$headers = @{ Authorization = "Bearer $accessToken" }
Invoke-RestMethod `
  -Method Get `
  -Uri http://localhost:5000/api/v1/auth/me `
  -Headers $headers
```

Refresh with the saved cookie session and replace the bearer token with the
returned value:

```powershell
$refreshed = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/v1/auth/refresh `
  -WebSession $authSession

$accessToken = $refreshed.data.accessToken
```

Logout is idempotent and clears the refresh cookie even when it is already
missing or invalid:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/v1/auth/logout `
  -WebSession $authSession
```

To revoke every active session, send the current bearer token to
`POST /api/v1/auth/logout-all`. See `docs/authentication.md` for token rotation,
reuse detection, cookie security, authorization, and error details.

### Authentication Environment

Use independent, randomly generated secrets of at least 32 characters. Example
placeholder values are development templates only and must never be deployed.

| Variable | Development default/example | Purpose |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | no safe runtime default | Signs access JWTs |
| `JWT_REFRESH_SECRET` | no safe runtime default | Separately signs refresh JWTs |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token and session lifetime |
| `AUTH_COOKIE_NAME` | `lead_saas_refresh_token` | Refresh-cookie name |
| `AUTH_COOKIE_SECURE` | `false` | Send the cookie only over HTTPS when `true`; production requires `true` |
| `AUTH_COOKIE_SAME_SITE` | `lax` | Cookie `SameSite` policy |
| `AUTH_COOKIE_DOMAIN` | blank | Optional cookie domain; blank creates a host-only cookie |
| `AUTH_COOKIE_PATH` | `/api/v1/auth` | Restricts where the browser sends the refresh cookie |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Login limiter window |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | Login attempts allowed per IP/window |
| `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS` | `3600000` | Registration limiter window |
| `AUTH_REGISTER_RATE_LIMIT_MAX` | `5` | Registrations allowed per IP/window |
| `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS` | `900000` | Refresh limiter window |
| `AUTH_REFRESH_RATE_LIMIT_MAX` | `30` | Refresh attempts allowed per IP/window |

`AUTH_COOKIE_SAME_SITE=none` must be paired with
`AUTH_COOKIE_SECURE=true`. Keep `AUTH_COOKIE_DOMAIN` blank unless cookies
intentionally need to span trusted subdomains.

### Authentication Migration And Tests

With a local `.env` configured for development:

```powershell
docker compose up -d postgres redis
npm install
npm run prisma:format --workspace=@lead-saas/api
npm run prisma:validate --workspace=@lead-saas/api
npm run prisma:generate --workspace=@lead-saas/api
npm run db:migrate:dev --workspace=@lead-saas/api -- --name add_auth_sessions
npm run typecheck
npm run build
npm run test
```

Never point authentication integration tests or destructive cleanup at the
development or production database. Use the suite's isolated test database
configuration. Do not use `prisma db push`; authentication schema changes are
tracked in the `add_auth_sessions` migration.

## Permitted Fixture Scraping POC

With the API and worker running, enqueue a fixture job without making internet requests:

```powershell
$body = @{
  sourceKey = "fixture-directory"
  country = "United States"
  state = "Texas"
  city = "Houston"
  category = "Roofing"
  searchQuery = "roofing contractors in Houston Texas"
  requestedLimit = 20
} | ConvertTo-Json

$created = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/scraping-jobs/test -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/scraping-jobs/$($created.data.scrapingJobId)"
$leads = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/leads?scrapingJobId=$($created.data.scrapingJobId)&page=1&limit=20"
```

Jobs receive three attempts with exponential backoff starting at five seconds. Completed and failed jobs retain bounded history for local diagnostics. Stop local services with `docker compose down`; named volumes preserve PostgreSQL and Redis data. See `docs/queue.md` for architecture and consistency details.

The POC accepts at most 100 records per job. `fixture-directory` uses fictional local HTML only. The controlled HTTP adapter remains disabled unless an administrator explicitly enables it and configures an approved base URL after reviewing source terms. Public visibility alone is not permission to scrape. The project never bypasses login systems, CAPTCHAs, robots policies, rate limits, or technical access controls. Detailed safeguards and normalization rules are in `docs/scraping.md`.

## Compliance Notice

This project processes only publicly available business information and uses legitimate and permitted sources. It must not bypass login systems, CAPTCHAs, or technical access restrictions. All collection and processing must respect source terms, rate limits, and applicable laws.
