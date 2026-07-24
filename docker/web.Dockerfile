# Stage 1: Build frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/

# Install dependencies deterministically
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Build React SPA production bundle
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME="US Business Lead SaaS"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build --workspace=@lead-saas/web

# Stage 2: Production Nginx web server
FROM nginx:1.27-alpine AS production

# Copy custom Nginx reverse proxy configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend bundle
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
