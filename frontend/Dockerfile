# syntax=docker/dockerfile:1

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG VITE_API_BASE_URL
ARG VITE_HLS_ENDPOINT

# Copy package files and install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code and build
COPY . .
RUN --mount=type=cache,target=/root/.npm \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_HLS_ENDPOINT=${VITE_HLS_ENDPOINT} \
    npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.standalone.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]