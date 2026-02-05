# Base stage
FROM node:20-alpine AS base
WORKDIR /app
# Install system dependencies if needed (e.g. for Prisma or native modules)
RUN apk add --no-cache openssl

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package.jsons to install dependencies correctly
# We need to recreate the directory structure for workspaces
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

# Install dependencies (including devDependencies for building)
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Nested node_modules are usually hoisted to root by npm ci
# COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
# COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source selection
COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build shared types first
RUN npm run build -w packages/types

# Generate Prisma Client (requies schema)
WORKDIR /app/apps/api
RUN npx prisma generate

# Build API
WORKDIR /app
RUN npm run build -w apps/api

# Runner stage
FROM base AS runner
WORKDIR /app

# Copy necessary files for runtime
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json

# Copy API build artifacts
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copy prisma directory if needed for migrations at runtime, or at least the schema
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
# Port exposed by Fastify
EXPOSE 4000

# Start command
# We run from root to mirror the dev structure, but pointing to the compiled dist
CMD ["node", "apps/api/dist/index.js"]
