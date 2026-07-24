# Production Release Checklist

Use this checklist before releasing a new version of the US Business Lead SaaS platform to production.

---

## 1. Environment & Security Verification

- [ ] `.env` file created from `.env.production.example` on target production server.
- [ ] `NODE_ENV` is set to `production`.
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are strong, random 64-byte strings and non-identical.
- [ ] `AUTH_COOKIE_SECURE=true` is enabled.
- [ ] `FRONTEND_URL` is set to the exact production domain (no `localhost` or wildcard `*`).
- [ ] No placeholder passwords or secrets exist in `.env`.
- [ ] Rate limits (`AUTH_LOGIN_RATE_LIMIT_MAX`, `GLOBAL_RATE_LIMIT`) are appropriate for expected traffic.

---

## 2. Database & Migration Readiness

- [ ] PostgreSQL backup completed prior to migration execution (`pg_dump`).
- [ ] All new database migrations are committed under `apps/api/prisma/migrations`.
- [ ] Prisma schema is formatted (`npm run prisma:format --workspace=@lead-saas/api`).
- [ ] Prisma schema is valid (`npm run prisma:validate --workspace=@lead-saas/api`).
- [ ] Migration execution planned via automated one-shot `migration` Docker container (`npx prisma migrate deploy`).

---

## 3. Code Quality & Build Gates

- [ ] Monorepo typecheck passes with 0 errors (`npm run typecheck`).
- [ ] All unit and integration test suites pass (`npm run test`).
- [ ] Production build succeeds without errors (`npm run build`).
- [ ] Docker Compose syntax validation succeeds (`docker compose config`).

---

## 4. Container & Infrastructure Readiness

- [ ] Production Dockerfiles built successfully (`api.Dockerfile`, `worker.Dockerfile`, `web.Dockerfile`).
- [ ] Containers configured to run under unprivileged non-root users (`USER node` / `nginx`).
- [ ] Nginx reverse proxy configured with SPA fallback and API headers forwarding (`X-Request-ID`, `X-Correlation-ID`, `X-Real-IP`).
- [ ] TLS certificate configured on Nginx / Load Balancer.
- [ ] Named Docker volumes (`postgres_data`, `redis_data`) configured for persistence.

---

## 5. Third-Party Integrations & Compliance

- [ ] Stripe live keys and webhook secret configured in `.env` if billing is enabled.
- [ ] Google Places API key / Meta / Yelp API keys configured if official sources are enabled.
- [ ] Scraping policy enabled only for approved, policy-compliant data sources.
- [ ] User-agent string configured with valid contact domain (`SCRAPING_USER_AGENT`).

---

## 6. Observability & Post-Launch Verification

- [ ] Health summary endpoint responding 200 OK (`GET /api/v1/health`).
- [ ] Liveness probe responding 200 OK (`GET /api/v1/health/liveness`).
- [ ] Readiness probe responding 200 OK (`GET /api/v1/health/readiness`).
- [ ] Metrics endpoint responding properly (`GET /api/v1/health/metrics`).
- [ ] Error logs monitored for unhandled exceptions or unexpected 5xx responses.
