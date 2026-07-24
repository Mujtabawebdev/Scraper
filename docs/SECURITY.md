# Security Documentation

## Overview

This document describes the security model and hardening measures implemented in the US Business Lead SaaS platform.

---

## HTTP Security Headers

All API responses include the following security headers configured via [Helmet.js](https://helmetjs.github.io/):

| Header | Value / Policy |
|---|---|
| `X-Frame-Options` | `DENY` — prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` — prevents MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` — enforces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; object-src 'none'; frame-ancestors 'none'` (full policy in `app.ts`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), display-capture=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-Request-ID` | Auto-generated UUID per request (or echoed from incoming header) |
| `X-Correlation-ID` | Forwarded or generated per trace |

---

## Request Context Tracing

Every request is assigned:
- **Request ID** (`X-Request-ID`): A UUID generated at the edge or provided by an upstream proxy. Echoed in the response.
- **Correlation ID** (`X-Correlation-ID`): Passed through from upstream services to enable distributed tracing. Defaults to the Request ID if absent.

Both values are injected into the Pino logger context for every log line emitted during that request.

---

## Rate Limiting

### Global API Rate Limiter

- **Window**: 15 minutes
- **Limit**: 200 requests per IP / authenticated user
- **Error code**: `GLOBAL_RATE_LIMIT_EXCEEDED`
- **Applies to**: All `/api/v1/*` routes (health excluded)

### Authentication Rate Limiters

| Endpoint | Window | Max Requests |
|---|---|---|
| `POST /api/v1/auth/register` | 60 minutes | 5 |
| `POST /api/v1/auth/login` | 15 minutes | 10 |
| `POST /api/v1/auth/refresh` | 15 minutes | 30 |

- **Error code**: `AUTH_RATE_LIMIT_EXCEEDED`

### Resource Rate Limiters

| Resource | Window | Max Requests |
|---|---|---|
| Job creation | 60 minutes | 10 per user |
| Job retry | 60 minutes | 20 per user |
| Lead export | 15 minutes | 10 per user |
| Lead verification | 15 minutes | 20 per user |
| CSV import | 60 minutes | 10 per user |
| Source health check | 15 minutes | 10 per user |

---

## Account Lockout

Consecutive failed login attempts trigger a temporary account lockout:

- **Threshold**: 5 consecutive failures within a 15-minute window
- **Lockout duration**: 15 minutes
- **Error code**: `ACCOUNT_LOCKED` (HTTP 429)
- **Audit event**: Written to the `audit_logs` table on lockout trigger
- **Reset**: Successful login clears the failure counter
- **Storage**: In-memory per API process (suitable for single-instance; use Redis for multi-instance)

---

## Authentication & Session Security

### Token Architecture

| Token | Location | Lifetime | Rotation |
|---|---|---|---|
| Access token (JWT) | `Authorization: Bearer` header | 15 minutes | N/A |
| Refresh token (JWT) | `HttpOnly; SameSite` cookie | 7 days | Rotated on every `/refresh` call |

### Refresh Token Rotation & Replay Protection

- Every call to `POST /api/v1/auth/refresh` issues a **new** refresh token and **revokes** the old one atomically.
- If a revoked refresh token is reused (replay attack), **all active sessions for that user are immediately revoked** and `REFRESH_TOKEN_REUSE_DETECTED` (HTTP 401) is returned.

### Secure Cookie Configuration

| Attribute | Value |
|---|---|
| `HttpOnly` | `true` — inaccessible to JavaScript |
| `Secure` | Configurable via `AUTH_COOKIE_SECURE` (set `true` in production) |
| `SameSite` | Configurable via `AUTH_COOKIE_SAME_SITE` (use `strict` or `lax`) |
| `Path` | `/api/v1/auth` — scoped to auth routes only |

### Session Management APIs

| Endpoint | Description |
|---|---|
| `GET /api/v1/auth/sessions` | List all active sessions (IP, user-agent, isCurrentSession) |
| `DELETE /api/v1/auth/sessions/:sessionId` | Revoke a specific session (forced logout of any device) |
| `POST /api/v1/auth/logout-all` | Revoke all active sessions immediately |

---

## Payload Security

- **Request size limit**: 1 MB (`express.json({ limit: "1mb" })`)
- **Malformed JSON**: Returns `400 VALIDATION_ERROR` with a safe generic message
- **Cookie parser**: Integrated for secure HttpOnly cookie reading without direct client exposure

---

## RBAC (Role-Based Access Control)

All protected endpoints use the `authenticate` middleware followed by `authorizeRoles(...)`:

| Role | Description |
|---|---|
| `USER` | Standard user: can access own scraping jobs, leads, billing |
| `ADMIN` | Admin: can manage users, view all jobs, audit logs |
| `SUPER_ADMIN` | Full admin: can promote/demote roles, manage plans |

Admin-only routes are prefixed under `/api/v1/admin` and require `ADMIN` or `SUPER_ADMIN`.

---

## Sensitive Field Masking in Logs

The Pino logger is configured with `redact` to automatically censor:

- `req.headers.authorization`
- `req.headers.cookie` / `res.headers.set-cookie`
- `req.body.password` / `*.passwordHash`
- `*.accessToken` / `*.refreshToken` / `*.refreshTokenHash`

All redacted fields appear as `[REDACTED]` in log output.

---

## Audit Logging

Security-critical events are written to the `audit_logs` PostgreSQL table:

| Event | Trigger |
|---|---|
| `auth.register.success` | Successful registration |
| `auth.login.success` | Successful login |
| `auth.login.failed` | Failed login attempt |
| `ACCOUNT_LOCKED` | Account locked after consecutive failures |
| `auth.refresh.success` | Token refresh |
| `auth.refresh.reuse_detected` | Replay attack detected — all sessions revoked |
| `auth.logout` | Normal logout |
| `auth.logout_all` | Logout from all devices |
| `SESSION_REVOKED` | Individual session revocation via device management |

---

## Secret Management

- Never commit secrets to version control.
- Use a `.env` file locally (not committed); see `.env.example` for required variables.
- In production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) and inject via environment variables.
- JWT secrets must be at least 64 random bytes (use `openssl rand -base64 64`).

---

## Deployment Checklist

- [ ] Set `AUTH_COOKIE_SECURE=true` in production
- [ ] Set `AUTH_COOKIE_SAME_SITE=strict` in production
- [ ] Use strong, randomly generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Enable HTTPS / TLS termination in front of the API
- [ ] Configure `FRONTEND_URL` to the exact production origin (no wildcards)
- [ ] Set `NODE_ENV=production` to suppress stack traces in error responses
- [ ] Set appropriate `AUTH_LOGIN_RATE_LIMIT_MAX` for your traffic profile
- [ ] Rotate JWT secrets periodically (requires re-login for all users)
