# Builder (Standalone for Staff Client)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for cache efficiency
COPY apps/staff/client/package.json ./
COPY apps/staff/client/package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source
COPY apps/staff/client ./

# Build
RUN npm run build

# Runner Stage (Nginx)
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

# Copy build output
COPY --from=builder /app/dist .
# Copy nginx config (using the one in apps/staff root)
COPY apps/staff/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
