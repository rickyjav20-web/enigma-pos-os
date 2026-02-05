# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/hq/package.json ./apps/hq/package.json
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/hq ./apps/hq

# Build types first (HQ depends on it)
RUN npm run build -w packages/types
# Build HQ
RUN npm run build -w apps/hq

# Runner stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static assets from builder stage
COPY --from=builder /app/apps/hq/dist .
# Copy custom nginx config
COPY apps/hq/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
