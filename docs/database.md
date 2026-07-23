# Database Foundation

## Architecture

Phase 2 uses PostgreSQL 17 for local development and Prisma ORM 7 with the `pg` driver through `@prisma/adapter-pg`. The root Docker Compose file owns the local database and persistent `postgres_data` volume. Runtime connections use `DATABASE_URL`; Prisma CLI migration operations use `DIRECT_DATABASE_URL` through `apps/api/prisma.config.ts`.

## Current Models

- `User` stores account identity, the Argon2id password hash, role, lifecycle
  status, last-login time, and relations to sessions, jobs, leads, and audit
  events.
- `UserSession` stores rotating refresh-session state and only a SHA-256 digest
  of the complete refresh JWT.
- `ScrapingJob` stores approved-source requests, lifecycle timestamps, separate
  processing counters, queue correlation, retry ancestry, and tenant ownership.
- `Lead` stores public business contact data, direct tenant ownership,
  originating-job ownership, and source traceability.
- `AuditLog` records safe authentication, user, or system actions with optional
  JSONB metadata.

Enums constrain user roles/statuses, future job lifecycle states, lead verification states, phone classifications, and permitted source categories.

## Naming Conventions

Prisma models and fields use PascalCase/camelCase. PostgreSQL tables and columns are mapped to plural snake_case names with `@@map` and `@map`. IDs are UUIDs and timestamps use timezone-aware PostgreSQL values.

## Local PostgreSQL

```powershell
docker compose up -d postgres
docker compose ps
docker compose stop postgres
```

The named volume preserves data across normal container restarts.

## Migration Workflow

```powershell
npm run prisma:format --workspace=@lead-saas/api
npm run prisma:validate --workspace=@lead-saas/api
npm run prisma:generate --workspace=@lead-saas/api
npm run db:migrate:dev --workspace=@lead-saas/api -- --name descriptive_name
npm run db:migrate:deploy --workspace=@lead-saas/api
```

`prisma migrate dev` is only for development. Production applies reviewed, existing migrations with `prisma migrate deploy`. Do not substitute `prisma db push` for tracked migrations.

## Authentication Sessions

The tracked `add_auth_sessions` migration adds the snake_case `user_sessions`
table and the `sessions` relation on `User`. Every session has a UUID primary
key and contains:

- its owning user ID;
- the required refresh-token hash;
- expiration and optional revocation timestamps;
- an optional replacement-session ID used to trace rotation;
- optional IP address and user agent;
- creation and update timestamps; and
- an optional last-used timestamp.

User, expiration, revocation, and refresh-hash lookups are indexed for session
validation and cleanup. The raw refresh JWT is never persisted. Rotation
conditionally revokes the current row and creates its replacement in a
transaction, while reuse detection revokes all remaining active sessions for
the affected user.

Password hashes and refresh-token hashes have different purposes. Passwords use
the deliberately expensive Argon2id password-hashing algorithm. Refresh JWTs
are already high-entropy signed bearer values, so the complete token is reduced
to a deterministic SHA-256 digest for database lookup and comparison.

## Deduplication And Traceability

`phoneNormalized` is indexed but not globally unique because different business locations can legitimately share a phone number. `sourceUrl` can be long and `sourceExternalId` is nullable, so Phase 2 does not add a potentially brittle composite unique index. A later ingestion phase will normalize candidate identifiers, query indexed fields, and perform application-level transactional upserts.

Every lead retains `sourceType`, `sourceName`, `sourceUrl`, optional external source ID, collection time, and originating job. This preserves provenance without implementing collection behavior.

The `enhance_job_lead_management` migration renames the existing job ownership
column without deleting data, adds the Phase 7 lifecycle fields, and backfills
each existing lead's non-null `userId` from its originating job. Tenant-first
job/lead indexes support ownership-scoped lists and summaries.

The follow-up `enforce_job_lead_ownership` migration adds a composite
`(jobId, userId)` foreign key. PostgreSQL therefore rejects a lead whose direct
tenant owner does not match its originating job owner, even if application code
is bypassed.

## Remaining Future Work

The schema now supports the authentication, lead, scraping, queue, and Redis
foundations added after Phase 2. It does not yet model email verification,
password recovery, MFA, subscriptions, payments, profile images, or production
deployment secret management.
