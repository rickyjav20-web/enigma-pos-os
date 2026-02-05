# Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package info context
COPY package*.json ./
COPY apps/pos/package*.json ./apps/pos/
COPY packages/types/package*.json ./packages/types/

# Install
RUN npm install

# Copy Source
COPY . .

# Build POS
WORKDIR /app/apps/pos
RUN npm run build

# Runner Stage (Nginx)
FROM nginx:alpine
COPY --from=builder /app/apps/pos/dist /usr/share/nginx/html
COPY apps/pos/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
