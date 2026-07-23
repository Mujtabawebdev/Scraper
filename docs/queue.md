# Redis And BullMQ Queue Foundation

## Architecture

The API is the BullMQ producer. It validates a mock request, creates a PostgreSQL `ScrapingJob`, and enqueues a typed `scrape-businesses` job. Redis persists BullMQ state in append-only mode. The separate `@lead-saas/worker` process consumes jobs and synchronizes progress and final status back to PostgreSQL.

The queue name defaults to `scraping-jobs` and the Redis key prefix defaults to `lead-saas`. The API and worker share compile-time payload/result contracts from `@lead-saas/shared-types`. The worker imports the single API-generated Prisma Client through the explicit `@lead-saas/api/prisma-client` package export, avoiding an independent schema or generated client.

## Job Contract

The payload contains the database job UUID, geographic/category filters, search query, requested mock limit, and requesting system-user UUID. The result contains the job UUID, processed/collected/failed counters, and completion timestamp. Payloads are not logged in full.

## Lifecycle And Progress

Database status flows through `PENDING`, `QUEUED`, `RUNNING`, then `COMPLETED` or final `FAILED`. The Phase-4 processor handles at most 100 permitted fixture records, updates BullMQ/database progress, and persists normalized non-duplicate leads.

Jobs have three attempts and exponential backoff beginning at five seconds. A processing exception is rethrown so BullMQ controls retries. The database is marked `FAILED` only after the final attempt is exhausted. Completed jobs retain up to 500 records for one day; failed jobs retain up to 1,000 records for seven days.

## Local Operation

```powershell
Copy-Item .env.example .env
docker compose up -d postgres redis
npm install
npm run prisma:generate --workspace=@lead-saas/api
npm run db:seed --workspace=@lead-saas/api
npm run dev:api
```

Start `npm run dev:worker` in a second terminal. Use the PowerShell request in the root README to enqueue and poll a test job. `WORKER_CONCURRENCY` defaults to `2` and is limited to `20`.

## Shutdown And Health

API shutdown closes its HTTP server, BullMQ queue, Redis health client, and Prisma resources. Worker shutdown waits for BullMQ worker close, then closes its Redis and Prisma resources. The API health route independently checks PostgreSQL with `SELECT 1` and Redis with `PING`, returning HTTP 503 without raw infrastructure errors when either is unavailable.

## Consistency Boundary

PostgreSQL record creation and Redis enqueue cannot be one atomic transaction. Phase 3 marks enqueue failures safely, but a process crash between database and Redis operations can still leave inconsistent state. A future production phase should use a transactional outbox and idempotent dispatcher.

## Current Limitation

The default adapter reads fictional local fixture HTML and makes no external request. The controlled HTTP adapter is disabled by default and requires explicit administrator configuration. Authentication, proxying, CAPTCHA handling, and prohibited-platform extraction remain excluded.
