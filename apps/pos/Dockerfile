# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage — install ALL workspace deps
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/hq/package.json ./apps/hq/package.json
COPY apps/kitchen-station/package.json ./apps/kitchen-station/package.json
COPY apps/ops/package.json ./apps/ops/package.json
COPY apps/pos/package.json ./apps/pos/package.json
COPY apps/staff/package.json ./apps/staff/package.json
COPY apps/wave-landing/package.json ./apps/wave-landing/package.json
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/pos/node_modules ./apps/pos/node_modules 2>/dev/null || true
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/pos ./apps/pos

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Force create .env file
RUN echo "VITE_API_URL=${VITE_API_URL}" > apps/pos/.env

# Build POS (skip tsc for Docker builds — Vite handles TS)
RUN cd apps/pos && npx vite build

# Runner stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=builder /app/apps/pos/dist .
COPY apps/pos/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
EXPOSE 80

CMD ["/bin/sh", "-c", "sed -i \"s/\\$PORT/$PORT/g\" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
