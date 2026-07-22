# Database Foundation

## Architecture

Phase 2 uses PostgreSQL 17 for local development and Prisma ORM 7 with the `pg` driver through `@prisma/adapter-pg`. The root Docker Compose file owns the local database and persistent `postgres_data` volume. Runtime connections use `DATABASE_URL`; Prisma CLI migration operations use `DIRECT_DATABASE_URL` through `apps/api/prisma.config.ts`.

## Current Models

- `User` stores account identity and lifecycle state without implementing authentication.
- `ScrapingJob` stores future collection requests, counters, status, and ownership.
- `Lead` stores public business contact data and source traceability.
- `AuditLog` records user or system actions with optional JSONB metadata.

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

## Deduplication And Traceability

`phoneNormalized` is indexed but not globally unique because different business locations can legitimately share a phone number. `sourceUrl` can be long and `sourceExternalId` is nullable, so Phase 2 does not add a potentially brittle composite unique index. A later ingestion phase will normalize candidate identifiers, query indexed fields, and perform application-level transactional upserts.

Every lead retains `sourceType`, `sourceName`, `sourceUrl`, optional external source ID, collection time, and originating job. This preserves provenance without implementing collection behavior.

## Excluded Future Work

Phase 2 does not include authentication, lead APIs, scraping, queues, Redis, billing, frontend work, or production deployment configuration.
