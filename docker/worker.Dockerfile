# Stage 1: Production dependency installer (with native module build tools)
FROM node:20-alpine AS deps

# Required for native module compilation (argon2 uses node-gyp / C++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install production-only dependencies (argon2 compiles here with build tools)
RUN npm ci --omit=dev

# ---

# Stage 2: Full dependency builder (compile TypeScript + generate Prisma Client)
FROM node:20-alpine AS builder

# Required for native module compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Placeholder URLs for Prisma generate (no DB connection made at generate time)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npm run prisma:generate --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/worker

# ---

# Stage 3: Production runtime image
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/

# Use the production-only node_modules (includes compiled argon2 binary)
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled artifacts and generated client
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Use unprivileged non-root user
USER node

CMD ["node", "apps/worker/dist/index.js"]
