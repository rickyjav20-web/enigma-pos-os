# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Copy ALL workspace package.json files so npm ci can resolve workspaces
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/hq/package.json ./apps/hq/package.json
COPY apps/kitchen-station/package.json ./apps/kitchen-station/package.json
COPY apps/ops/package.json ./apps/ops/package.json
COPY apps/pos/package.json ./apps/pos/package.json
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/pos ./apps/pos

# Build types first (POS may depend on it)
RUN npm run build -w packages/types 2>/dev/null || true

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Force create .env file
RUN echo "VITE_API_URL=${VITE_API_URL}" > apps/pos/.env

# Build POS
RUN npm run build -w apps/pos

# Runner stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static assets from builder stage
COPY --from=builder /app/apps/pos/dist .
# Copy custom nginx config
COPY apps/pos/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
EXPOSE 80

# Use sed to inject PORT and start nginx
CMD ["/bin/sh", "-c", "sed -i \"s/\\$PORT/$PORT/g\" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
