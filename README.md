# US Business Lead SaaS

A production-oriented SaaS for collecting and managing publicly available U.S. business contact information from legitimate and permitted sources.

## Planned Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Redux Toolkit, TanStack Query, and React Router.
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL, Prisma ORM, Redis, and BullMQ.
- **Scraping:** Cheerio and Playwright for permitted collection workflows.
- **Infrastructure:** Docker, Docker Compose, Nginx, and GitHub Actions.

## Monorepo Applications

- `apps/api`: Express REST API with authentication, leads, scraping jobs, health checks, and production middleware.
- `apps/worker`: BullMQ worker for permitted, user-owned scraping jobs.
- `apps/web`: React application with authentication, job management, lead
  exploration, and an owned dashboard.
- `packages/shared-types`: Non-Prisma API DTOs plus internal typed queue
  contracts.
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

In another terminal, start the frontend:

```powershell
npm run dev:web
```

The local worker concurrency is controlled by `WORKER_CONCURRENCY` and defaults to `2`.

The API runs at `http://localhost:5000`; health is at
`http://localhost:5000/api/v1/health`. The frontend runs at
`http://localhost:5173`. Copy `.env.example` to `.env` only when local
overrides are needed. Never commit real secrets.

## Frontend Application

The Phase 6 authentication foundation now hosts Phase 7's job history,
approved-source job form, live job detail, lead explorer, CSV export, and real
user-specific dashboard summary. Account settings remain intentionally limited
to the existing session actions.

The frontend workspace uses:

- Vite, React, and strict TypeScript;
- Tailwind CSS for the responsive UI foundation;
- React Router for public, protected, and role-aware navigation;
- Redux Toolkit only for global authentication state;
- TanStack Query for server state and authentication mutations;
- React Hook Form and Zod for accessible form validation; and
- Axios with a credentialed, typed API client.

### Frontend Environment

The browser receives only public `VITE_` configuration:

| Variable | Local value | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api/v1` | Versioned API base URL |
| `VITE_APP_NAME` | `US Business Lead SaaS` | User-facing application name |

Backend JWT secrets, database credentials, Redis credentials, and refresh
tokens must never be exposed through `VITE_` variables. Frontend environment
validation fails clearly when the API URL is missing or invalid.

### Frontend Commands

```powershell
npm run dev:web
npm run typecheck --workspace=@lead-saas/web
npm run build --workspace=@lead-saas/web
npm run test --workspace=@lead-saas/web
```

The root `npm run typecheck`, `npm run build`, and `npm run test` commands
validate all participating workspaces, including the web application.

### Browser Authentication Flow

Registration and login place the short-lived access token in Redux memory and
never in `localStorage` or `sessionStorage`. The API sends the rotating refresh
token only as an `HttpOnly` cookie, so frontend JavaScript cannot read or
persist it.

On a new page load, browser memory is empty. The app makes one credentialed
`POST /auth/refresh` request, stores the returned access token in memory, then
loads `GET /auth/me`. A full-page loader prevents routing decisions until this
bootstrap finishes. If refresh fails, the user remains logged out.

The API client sends bearer access tokens and includes browser credentials. A
`401` triggers one coordinated refresh attempt and retries the original request
once. Concurrent failures share that refresh operation; refresh failure clears
authentication state and does not enter an infinite retry loop.

Logout calls `POST /auth/logout`, clears local authentication and query state
even if the network request fails, and returns the user to `/login`.
Logout-all calls the protected `POST /auth/logout-all` endpoint and applies the
same local cleanup. See `docs/frontend-auth.md` for the complete frontend
architecture and security decisions.

### Frontend Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Redirect according to authentication state |
| `/login` | Signed-out users | Password login |
| `/register` | Signed-out users | Account registration |
| `/dashboard` | Authenticated users | Real owned job and lead summary |
| `/dashboard/jobs` | Authenticated users | Filtered, paginated job history |
| `/dashboard/jobs/new` | Authenticated users | Approved-source job creation |
| `/dashboard/jobs/:jobId` | Authenticated owner | Progress, statistics, cancel, and retry |
| `/dashboard/leads` | Authenticated users | Server-filtered lead explorer and CSV export |
| `/dashboard/leads/:leadId` | Authenticated owner | Safe business lead detail |
| `/dashboard/settings` | Authenticated users | Account/session actions and later-phase placeholder |
| `/unauthorized` | Public | Insufficient-role explanation |
| `*` | Public | Not-found page |

### Integrated Local Authentication Check

Start PostgreSQL and Redis, then run the API and frontend in separate terminals:

```powershell
docker compose up -d postgres redis
npm run dev:api
```

```powershell
npm run dev:web
```

Open `http://localhost:5173` and verify registration, the dashboard redirect,
page-reload restoration through the refresh cookie, job creation and polling,
lead filtering/detail/export, cancellation/retry, logout, protected route
redirects, and mobile navigation. Local credentialed requests are allowed from
`http://localhost:5173` to `http://localhost:5000`; production must retain an
explicit trusted origin and secure cookie settings.

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

## Scraping Jobs And Lead Explorer

All Phase 7 data endpoints require a bearer access token and scope repository
queries to the authenticated user.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/scraping-jobs` | Validate and enqueue an approved-source job |
| `GET` | `/api/v1/scraping-jobs` | Search, filter, sort, and paginate owned jobs |
| `GET` | `/api/v1/scraping-jobs/:jobId` | Read owned progress and statistics |
| `POST` | `/api/v1/scraping-jobs/:jobId/cancel` | Cancel an active owned job |
| `POST` | `/api/v1/scraping-jobs/:jobId/retry` | Create a linked retry for an owned failed job |
| `GET` | `/api/v1/leads` | Search, filter, sort, and paginate owned leads |
| `GET` | `/api/v1/leads/:leadId` | Read an owned lead |
| `GET` | `/api/v1/leads/export.csv` | Export the current owned lead filters |
| `GET` | `/api/v1/dashboard/summary` | Read compact owned job/lead totals |

With PostgreSQL, Redis, the API, and worker running, enqueue the fictional local
fixture without making an internet request:

```powershell
$body = @{
  source = "fixture-business-directory"
  searchQuery = "plumbers"
  location = "Austin, TX"
  requestedLimit = 100
} | ConvertTo-Json

$created = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/v1/scraping-jobs `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body

$jobId = $created.data.job.id
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/scraping-jobs/$jobId" `
  -Headers $headers

$leads = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/leads?jobId=$jobId&page=1&pageSize=25" `
  -Headers $headers
```

The UI uses TanStack Query polling only for `PENDING`, `QUEUED`, and `RUNNING`
jobs. Cancellation is database-first and cooperative; retry creates a new
linked row so the original failure remains auditable. Leads collected before a
cancellation remain available. See `docs/job-management.md`.

Lead search, filters, allowlisted sorting, and pagination are performed by
PostgreSQL, not by downloading the complete dataset. CSV export applies the
same tenant/filter predicates, a synchronous row ceiling, safe quoting, and
spreadsheet-formula injection protection. See `docs/lead-explorer.md`.

Jobs retain BullMQ's three automatic attempts with exponential backoff starting
at five seconds. Completed and failed queue history remains bounded for local
diagnostics. Stop local services with `docker compose down`; named volumes
preserve PostgreSQL and Redis data. See `docs/queue.md` for consistency details.

The Phase 7 form accepts only the compiled, controlled source list and at most
100 records. `fixture-business-directory` maps to fictional local HTML.
`permitted-http-directory` remains disabled unless an administrator explicitly
enables it and configures its fixed approved base URL after reviewing source
terms; users can never submit a URL.
Public visibility alone is not permission to scrape. The project never
bypasses login systems, CAPTCHAs, robots policies, rate limits, or technical
access controls. Detailed safeguards are in `docs/scraping.md`.

## Compliance Notice

This project processes only publicly available business information and uses legitimate and permitted sources. It must not bypass login systems, CAPTCHAs, or technical access restrictions. All collection and processing must respect source terms, rate limits, and applicable laws.
