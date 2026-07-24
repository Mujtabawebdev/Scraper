# Stage 1: Production dependency installer (with native module build tools)
FROM node:20-alpine AS deps

# Required for native module compilation (argon2 uses node-gyp / C++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install production-only dependencies (argon2 compiles here with build tools)
RUN npm ci --omit=dev

# ---

# Stage 2: Full dependency builder (compile TypeScript + generate Prisma Client)
FROM node:20-alpine AS builder

# Required for native module compilation (argon2 uses node-gyp / C++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install all dependencies (including dev: typescript, tsx, prisma CLI, vitest)
RUN npm ci

# Copy application source code
COPY packages ./packages
COPY apps/api ./apps/api

# Prisma generate reads prisma.config.ts which calls env("DIRECT_DATABASE_URL").
# The URL is only used for schema resolution — no actual DB connection is made.
# We supply a placeholder so the generate step succeeds in a CI/build environment.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Generate Prisma Client and compile TypeScript
RUN npm run prisma:generate --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/api

# ---

# Stage 3: Production runtime image
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package manifests for workspace module resolution
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Use the production-only node_modules (includes compiled argon2 binary and prisma CLI)
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled artifacts, Prisma schema/migrations and generated client
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated

# NOTE: prisma.config.ts is intentionally NOT copied here.
# The migration command runs from /app/apps/api where no prisma.config.ts exists,
# so prisma migrate deploy reads DATABASE_URL directly from the environment.

# Use unprivileged non-root user
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health/liveness', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
