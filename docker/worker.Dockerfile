# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/

# Install dependencies deterministically
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Generate Prisma Client and compile worker TypeScript
RUN npm run prisma:generate --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/api
RUN npm run build --workspace=@lead-saas/worker

# Stage 2: Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy root workspace manifests and install production-only dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/

RUN npm ci --omit=dev

# Copy compiled artifacts and generated client from builder
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Use unprivileged non-root user
USER node

CMD ["node", "apps/worker/dist/index.js"]
