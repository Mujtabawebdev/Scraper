# Scraping Job Management

## Scope And Source Policy

Phase 7 turns the permitted Phase 4 pipeline into an authenticated, user-owned
workflow. A browser user selects from a compiled source allowlist.
`fixture-business-directory` is always available and uses fictional local
data. `permitted-http-directory` preserves the Phase 4 development adapter but
is accepted only when the server administrator enables it and configures its
fixed approved base URL. Clients cannot provide an adapter key, URL, queue
payload, Redis key, or arbitrary origin.

Every job endpoint requires a valid bearer access token. The API takes the
owner ID only from the authenticated request context and all repository reads
and state changes include that owner ID. An unknown job and another user's job
both return `SCRAPING_JOB_NOT_FOUND` with HTTP 404.

## Creation And Queue Handoff

`POST /api/v1/scraping-jobs` accepts a strict body containing `source`,
`searchQuery`, `location`, and a development-safe `requestedLimit` of 1–100.
The API:

1. creates an owned PostgreSQL row in `PENDING`;
2. submits a typed `scrape-businesses` BullMQ job;
3. saves the BullMQ job ID and conditionally changes `PENDING` to `QUEUED`; and
4. returns HTTP 202 with a safe public job DTO.

The conditional update prevents a fast worker from being moved backwards from
`RUNNING` to `QUEUED`. If queue submission fails, the API conditionally records
`FAILED`, `failedAt`, and a generic error summary rather than leaving a
misleading queued state. PostgreSQL and Redis are still separate consistency
boundaries; a transactional outbox remains future production work.

## Lifecycle And Progress

The public lifecycle is:

```text
PENDING -> QUEUED -> RUNNING -> COMPLETED
                         |---> FAILED
PENDING/QUEUED/RUNNING --+---> CANCELLED
FAILED ----------------------> new retry job
```

The worker verifies that queue ownership and source match the database job,
sets `startedAt` once, and reports bounded progress. Counters have distinct
meanings:

- `processedCount`: source records examined;
- `successCount`: leads created, or already created idempotently for this job;
- `failureCount`: invalid or unprocessable records;
- `duplicateCount`: in-batch or same-user database duplicates; and
- `progressPercentage`: a clamped 0–100 stage/progress value.

Completion and terminal failure use conditional database updates. A cancelled
row therefore cannot later be overwritten with `COMPLETED` or `FAILED`.
Terminal worker errors contain a safe summary, never a stack trace or source
response.

## Cancellation

`POST /api/v1/scraping-jobs/:jobId/cancel` is valid only for `PENDING`,
`QUEUED`, or `RUNNING`. The database transition to `CANCELLED` is the
linearization point. The API then makes a best-effort attempt to remove a
waiting BullMQ job. If a worker already holds the job lock, cancellation is
cooperative: the worker checks database state at bounded checkpoints and
stops before further persistence. Leads collected before cancellation remain.

Terminal states return `SCRAPING_JOB_NOT_CANCELLABLE`; they are not silently
reset.

## Retry

`POST /api/v1/scraping-jobs/:jobId/retry` accepts an owned `FAILED` job only.
It creates and queues a new job with copied approved input and a
`retryOfJobId` link. The original row remains immutable history. Running,
completed, queued, pending, and cancelled rows return
`SCRAPING_JOB_NOT_RETRYABLE`.

This manual retry is separate from BullMQ's bounded automatic attempts.

## Listing, Detail, And Polling

The list endpoint implements server-side search, status/source filters, date
ranges, allowlisted sorting, and pagination. The detail response includes
statistics, safe terminal information, related-lead count, `canCancel`, and
`canRetry`; it never includes BullMQ payloads or Redis internals.

The React detail query polls every few seconds only while a job is `PENDING`,
`QUEUED`, or `RUNNING`. TanStack Query stops the interval for terminal data and
automatically removes it on unmount. An active-to-terminal transition
invalidates the scoped job list, lead list, and dashboard summary.

## Rate Limits And Errors

Job creation and manual retry have dedicated authenticated-user limits in the
current single-instance API. They do not weaken or restrict unrelated
endpoints. Limit failures use the common JSON error envelope and
`RATE_LIMIT_EXCEEDED`. A Redis-backed distributed limiter with additional
network-abuse controls is future work for a multi-instance deployment.

Expected job errors include:

- `VALIDATION_ERROR`
- `APPROVED_SOURCE_REQUIRED`
- `SOURCE_NOT_PERMITTED`
- `SCRAPING_JOB_NOT_FOUND`
- `SCRAPING_JOB_NOT_CANCELLABLE`
- `SCRAPING_JOB_NOT_RETRYABLE`
- `QUEUE_UNAVAILABLE`
- `RATE_LIMIT_EXCEEDED`

## Current Limitations

Phase 7 intentionally has no unrestricted source selection, WebSocket events,
proxy rotation, CAPTCHA/login bypass, billing limits, team ownership, admin
workflow, or production crawler. The local fixture contains fictional business
records and makes no external request; the approved development adapter is
server-configured and disabled by default.
