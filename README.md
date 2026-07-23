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
