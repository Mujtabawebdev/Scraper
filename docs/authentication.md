# Authentication And Authorization

## Scope

Phase 5 adds the API authentication and authorization foundation:

- user registration and password login;
- short-lived JWT access tokens;
- rotating JWT refresh tokens backed by PostgreSQL sessions;
- logout for one session or every session;
- current-user lookup;
- active-account and active-session enforcement;
- typed role authorization;
- endpoint-specific IP rate limiting; and
- security audit events.

It does not add a frontend, email verification, password recovery, password
reset, social login, two-factor authentication, subscription authorization, or
admin application endpoints.

## Endpoints

All endpoints are mounted below `/api/v1/auth`.

| Method | Path | Credential | Success |
| --- | --- | --- | --- |
| `POST` | `/register` | none | `201` with user and access token |
| `POST` | `/login` | none | `200` with user and access token |
| `POST` | `/refresh` | refresh cookie | `200` with a replacement access token |
| `POST` | `/logout` | optional refresh cookie | `200`; idempotent |
| `POST` | `/logout-all` | bearer access token | `200` after revoking all sessions |
| `GET` | `/me` | bearer access token | `200` with the current user |

Access tokens are returned in JSON and must be sent as:

```http
Authorization: Bearer <access-token>
```

Refresh tokens are never accepted in a request body or authorization header and
are never returned in JSON.

## Password Security

User passwords are hashed with Argon2id. The implementation uses the library's
constant-time verification and production-suitable memory, time, and
parallelism settings; it does not implement custom password cryptography.

Registration accepts passwords from 8 through 128 characters and requires at
least one uppercase letter, one lowercase letter, one number, and one special
character. Registration validation may describe the unmet rule. Login always
uses the generic message `Invalid email or password` for an unknown email,
malformed stored hash, or incorrect password.

Email addresses are trimmed and lowercased before lookup. Names are trimmed and
repeated whitespace is collapsed. Request schemas reject unknown fields.

The development account `system@lead-saas.local` retains a deliberately invalid,
non-login password hash. No password is generated or published for that account.

## Access Tokens

Access tokens are HS256 JWTs signed with `JWT_ACCESS_SECRET`. They normally
expire after 15 minutes and contain only:

- `sub`: user ID;
- `role`: current role;
- `sessionId`: originating session ID; and
- `tokenType`: `access`.

The token service also sets issued-at and expiration claims and verifies:

- algorithm and signature;
- issuer `lead-saas-api`;
- audience `lead-saas-client`;
- expiration;
- required subject/session claims; and
- `tokenType=access`.

Authentication middleware loads the user and referenced session from
PostgreSQL. Both the account and session must remain active. A suspended or
disabled account is forbidden, while a missing, expired, revoked, malformed, or
incorrectly signed credential is rejected without exposing JWT library details.
Because the access token is tied to an active session, logout and logout-all
invalidate subsequent use of that session even before the JWT's normal
expiration.

Access tokens are bearer credentials. Clients must keep them out of URLs, logs,
analytics, and persistent browser storage where untrusted scripts could read
them.

## Refresh Tokens And Sessions

Refresh tokens are separate HS256 JWTs signed with `JWT_REFRESH_SECRET`. They
normally expire after seven days and contain only:

- `sub`: user ID;
- `sessionId`: session ID;
- `tokenType`: `refresh`; and
- a unique JWT identifier.

They use the same issuer and audience checks as access tokens. The separate
secret prevents an access-token signing context from being accepted as a
refresh-token context.

Each login or registration creates a `UserSession` row. The complete signed
refresh token is hashed with SHA-256, and only that digest is stored in
`refreshTokenHash`. SHA-256 is suitable here because the signed token is a
high-entropy bearer value; passwords continue to use the intentionally expensive
Argon2id algorithm. PostgreSQL never stores the plaintext refresh token.

The session also records its user, expiration, revocation and replacement
state, creation/update timestamps, last use, and optional IP address and user
agent. These metadata fields must never contain authorization headers, cookies,
tokens, password values, or token hashes.

## Rotation And Reuse Detection

`POST /refresh` performs these checks and changes:

1. Read the configured refresh cookie.
2. Verify the refresh JWT, issuer, audience, type, and expiration.
3. Compute the complete token's SHA-256 digest.
4. Load the token's user and session and compare the stored digest.
5. Confirm that the account and session remain active.
6. Atomically revoke the old session and create a replacement session.
7. Link the old row through `replacedBySessionId`.
8. Sign a replacement access token and refresh token.
9. Store only the new refresh digest and replace the cookie.

Rotation uses a transaction and a conditional old-session update, so concurrent
requests cannot both rotate the same active session. The first request consumes
the session. A later presentation of that revoked refresh token is treated as
possible theft or replay: all active sessions for its user are revoked, the
refresh cookie is cleared, a safe security event is recorded, and the API
returns `401 REFRESH_TOKEN_REUSE_DETECTED`.

Invalid or expired refresh tokens return `401` without raw JWT or database
details. Logout is deliberately idempotent: it attempts to revoke a matching
session, always clears the cookie, and returns `200` even when the cookie is
missing or invalid.

## Refresh Cookie

The refresh credential is sent only in a cookie configured from the
authentication environment:

- `HttpOnly=true`;
- `Secure` from `AUTH_COOKIE_SECURE`;
- `SameSite` from `AUTH_COOKIE_SAME_SITE`;
- path from `AUTH_COOKIE_PATH`, normally `/api/v1/auth`;
- `Max-Age` aligned with the refresh-token lifetime; and
- `Domain` only when `AUTH_COOKIE_DOMAIN` is non-empty.

Local HTTP development uses `AUTH_COOKIE_SECURE=false`. Production rejects that
setting and requires HTTPS. `SameSite=None` is valid only with a secure cookie.
A blank domain creates the safer host-only cookie. The clear-cookie helper uses
the same path, domain, secure, and SameSite attributes so browsers remove the
correct cookie.

SameSite is a useful CSRF boundary but is not a universal replacement for CSRF
protection. A future deployment that intentionally enables cross-site cookies
must add an explicit CSRF design and tightly controlled credentialed CORS
origins.

## Authorization

`authenticate` verifies the bearer access token, loads the active user and
session, and attaches a typed authentication context to the Express request.
`authorizeRoles(...)` accepts only Prisma `UserRole` values and returns
`403 INSUFFICIENT_PERMISSIONS` when the authenticated role is not allowed.

Phase 5 supplies the middleware but does not expose admin or super-admin
business endpoints. Role checks complement authentication; they do not replace
resource ownership checks required by future features.

## Rate Limiting

Registration, login, and refresh have separate configurable IP-based limits.
Their window and maximum values are controlled by:

- `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS` and
  `AUTH_REGISTER_RATE_LIMIT_MAX`;
- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` and `AUTH_LOGIN_RATE_LIMIT_MAX`; and
- `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS` and
  `AUTH_REFRESH_RATE_LIMIT_MAX`.

The Phase 5 limiter uses in-process memory. Counters reset when the process
restarts and are not shared between API replicas. A later production phase
should use the existing Redis infrastructure with an audited distributed
`express-rate-limit` store.

Express derives the limiter address from `request.ip`. The application does not
blindly trust forwarding headers. When deployed behind a known reverse proxy,
configure `trust proxy` to the exact trusted proxy topology or hop count.
Setting it broadly can let clients spoof `X-Forwarded-For` and evade per-IP
limits. Direct deployments should leave proxy trust disabled.

## Audit Logging

Authentication writes the following best-effort `AuditLog` actions:

- `AUTH_REGISTER_SUCCESS`;
- `AUTH_LOGIN_SUCCESS`;
- `AUTH_LOGIN_FAILED`;
- `AUTH_REFRESH_SUCCESS`;
- `AUTH_REFRESH_REUSE_DETECTED`;
- `AUTH_LOGOUT`; and
- `AUTH_LOGOUT_ALL`.

Audit metadata is limited to safe operational context such as actor/entity IDs,
IP address, user agent, and non-sensitive outcome information. Passwords, JWTs,
cookie values, authorization headers, and refresh hashes are prohibited.
Routine audit-write failures are logged safely and do not turn an otherwise
successful authentication operation into a failure.

## Responses And Errors

Successful responses follow the existing API envelope:

```json
{
  "success": true,
  "message": "Current user fetched successfully",
  "data": {}
}
```

Errors use a safe code without raw Prisma, Argon2, or JWT errors:

```json
{
  "success": false,
  "message": "Authentication is required",
  "error": {
    "code": "AUTHENTICATION_REQUIRED"
  }
}
```

Validation failures may additionally contain sanitized Zod issues. Common
codes are:

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Request input failed validation |
| `401` | `INVALID_CREDENTIALS` | Email/password authentication failed |
| `401` | `AUTHENTICATION_REQUIRED` | Bearer credential is missing |
| `401` | `INVALID_ACCESS_TOKEN` | Access token cannot be accepted |
| `401` | `INVALID_REFRESH_TOKEN` | Refresh credential cannot be accepted |
| `401` | `REFRESH_TOKEN_REUSE_DETECTED` | A consumed refresh token was replayed |
| `403` | `ACCOUNT_SUSPENDED` | Suspended account cannot authenticate |
| `403` | `ACCOUNT_DISABLED` | Disabled account cannot authenticate |
| `403` | `INSUFFICIENT_PERMISSIONS` | Role is not permitted |
| `409` | `EMAIL_ALREADY_IN_USE` | Normalized email already exists |
| `429` | `AUTH_RATE_LIMIT_EXCEEDED` | Endpoint-specific request limit was reached |

Passwords, password hashes, refresh tokens, refresh hashes, sessions, stack
traces, and internal error objects are never included in API responses.

## Environment

The complete template is in `.env.example`. Authentication requires independent
strong access and refresh secrets. It also validates token durations, cookie
booleans and SameSite values, cookie path/domain, and positive bounded
rate-limit numbers. Placeholder secrets are permitted only as documented
development templates; production startup rejects them.

Do not print the parsed environment object because it contains signing secrets.
Secret changes invalidate tokens signed with the replaced key, so production
rotation requires an explicit deployment and session-revocation plan.

## Local Validation

Start local infrastructure, apply the tracked migration, and run all checks:

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

Use a dedicated test database for integration tests and verify its target before
cleanup. Never reset development or production data. Use Prisma migrations
rather than `prisma db push`.

## Current Limitations And Future Work

Phase 5 intentionally has these limits:

- in-memory rate limits do not coordinate across API replicas;
- HS256 secret storage and rotation depend on deployment secret management;
- cross-site cookie deployments need an explicit CSRF design;
- email ownership is not yet verified;
- there is no password recovery, reset, or password-change workflow;
- there is no MFA, two-factor authentication, OTP, or social login;
- there is no frontend token-management implementation; and
- there are no admin dashboard, subscription, payment, or profile-editing
  endpoints.

Future reviewed phases may add email verification, password recovery, MFA,
distributed Redis-backed rate limiting, key rotation, and additional session
management UX. Those features are not part of Phase 5.
