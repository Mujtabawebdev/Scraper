# Admin Dashboard And User Management

## Authorization Model

All routes under `/api/v1/admin` require a valid bearer access token, an active
server-side session, an `ACTIVE` database account, and the current database
role `ADMIN` or `SUPER_ADMIN`. The access-token role is never trusted alone:
authentication reloads the session owner before authorization.

`ADMIN` may view summaries, users, jobs, audit logs, and sources; manage status
for normal `USER` accounts; and cancel active jobs. `SUPER_ADMIN` additionally
manages roles and high-risk source settings. The API—not frontend visibility—
enforces these boundaries.

The disabled `system@lead-saas.local` seed account remains deliberately
non-login-capable. For the first real `SUPER_ADMIN`, register a normal account
and promote it through a controlled local database operation or deployment
bootstrap process. No reusable administrator password is seeded or documented.

## Admin APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/summary` | User, job, lead, and source totals |
| `GET` | `/api/v1/admin/users` | Server-filtered, sorted, paginated users |
| `GET` | `/api/v1/admin/users/:userId` | Safe profile, activity totals, sessions, audits |
| `PATCH` | `/api/v1/admin/users/:userId/status` | Audited status transition |
| `PATCH` | `/api/v1/admin/users/:userId/role` | SUPER_ADMIN-only role transition |
| `GET` | `/api/v1/admin/scraping-jobs` | Cross-account job monitoring |
| `GET` | `/api/v1/admin/scraping-jobs/:jobId` | Safe job detail |
| `POST` | `/api/v1/admin/scraping-jobs/:jobId/cancel` | Cooperative cancellation |
| `GET` | `/api/v1/admin/audit-logs` | Redacted audit events |
| `GET` | `/api/v1/admin/sources` | Governed source list |
| `GET` | `/api/v1/admin/sources/:sourceId` | Source review detail |
| `POST` | `/api/v1/admin/sources` | SUPER_ADMIN-only safe creation |
| `PATCH` | `/api/v1/admin/sources/:sourceId` | SUPER_ADMIN-only policy update |
| `POST` | `/api/v1/admin/sources/:sourceId/disable` | Disable automation |
| `POST` | `/api/v1/admin/sources/:sourceId/mark-review-required` | Return to review |

All list endpoints cap `pageSize` at 100 and use allowlisted sort/filter fields.
Responses use explicit selects and DTO mappers, so password hashes, refresh
hashes, cookies, authorization headers, queue payloads, and Redis internals are
not serialized.

## User Status Management

Allowed transitions are:

- `ACTIVE` to `SUSPENDED` or `DISABLED`;
- `SUSPENDED` to `ACTIVE` or `DISABLED`;
- `DISABLED` to `ACTIVE`.

An administrator cannot suspend or disable themself. A regular `ADMIN` can
modify only normal `USER` accounts. Suspension and disablement use one database
transaction to change status, revoke active sessions, mark active jobs
cancelled, and write the audit record. BullMQ removal is best-effort after the
transaction; database cancellation remains authoritative and the worker checks
it cooperatively.

## Role Management

Only a current active `SUPER_ADMIN` may change roles. The target cannot be the
actor. Role changes revoke every active session so new credentials must reflect
the new database role. An advisory transaction lock plus an active-super-admin
count protects the final active `SUPER_ADMIN` during concurrent changes.

## Job Monitoring

Admins can filter jobs by owner, status, source, search text, date, and
allowlisted sorting. Detail responses contain safe owner identity, progress,
counts, timestamps, a safe failure message, generated-lead count, cancellation
availability, and linked retry summaries. They do not contain BullMQ payloads
or connection details.

## Audit Logs

Administrator mutations record actor, target user where applicable, entity,
reason, safe transition metadata, IP address, and user agent. The response
mapper recursively redacts keys matching passwords, tokens, cookies,
authorization, secrets, API keys, credentials, refresh values, and hashes.
Values and collection depth are bounded.

## Frontend Architecture

The `/admin` tree uses `RoleRoute` plus a dedicated responsive layout. TanStack
Query owns summary, user, job, audit, and source server state through centralized
query keys. Redux remains limited to authentication. Mutations invalidate only
relevant admin query families. Confirmation dialogs describe session revocation
and cancellation effects.

Phase 8 excludes billing, teams, live WebSockets, arbitrary source collection,
and external integrations.
