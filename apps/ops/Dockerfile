# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/ops/package.json ./apps/ops/package.json
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/ops ./apps/ops

# Build types first (OPS depends on it)
RUN npm run build -w packages/types

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Force create .env file
RUN echo "VITE_API_URL=${VITE_API_URL}" > apps/ops/.env

# Build OPS
RUN npm run build -w apps/ops

# Runner stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static assets from builder stage
COPY --from=builder /app/apps/ops/dist .
# Copy custom nginx config
COPY apps/ops/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
