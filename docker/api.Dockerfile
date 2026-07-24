# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/

# Install dependencies deterministically
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Generate Prisma Client and compile TypeScript
RUN npm run prisma:generate --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/api

# Stage 2: Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy root workspace manifests and install production-only dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/

RUN npm ci --omit=dev

# Copy compiled artifacts and generated client from builder
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated

# Use unprivileged non-root user
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health/liveness', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
