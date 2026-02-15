# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Copy ALL workspace package.json files to satisfy npm ci
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/hq/package.json ./apps/hq/package.json
COPY apps/kitchen-station/package.json ./apps/kitchen-station/package.json
COPY apps/ops/package.json ./apps/ops/package.json
COPY apps/pos/package.json ./apps/pos/package.json

# Install dependencies (frozen-lockfile)
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/kitchen-station ./apps/kitchen-station

# Build types first (Kitchen depends on it)
RUN npm run build -w packages/types

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Force create .env file (Vite needs this at build time or runtime inject)
RUN echo "VITE_API_URL=${VITE_API_URL}" > apps/kitchen-station/.env

# Build Kitchen Station
# Use --if-present just in case, but it should exist
RUN npm run build -w apps/kitchen-station

# Runner stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static assets from builder stage
COPY --from=builder /app/apps/kitchen-station/dist .
# Copy custom nginx config
COPY apps/kitchen-station/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
