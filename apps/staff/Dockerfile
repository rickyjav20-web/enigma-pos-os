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

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

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

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
