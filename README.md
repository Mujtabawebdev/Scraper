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

Node.js 20 or newer is required.

```powershell
npm install
npm run typecheck
npm run build
npm run dev:api
```

The API runs at `http://localhost:5000`; health is at `http://localhost:5000/api/v1/health`. Copy `.env.example` to `.env` only when local overrides are needed. Never commit real secrets.

## Compliance Notice

This project processes only publicly available business information and uses legitimate and permitted sources. It must not bypass login systems, CAPTCHAs, or technical access restrictions. All collection and processing must respect source terms, rate limits, and applicable laws.
