# Stage 1: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy package files including lockfile for reproducible builds
COPY backend/package*.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build && mkdir -p dist/db/migrations && cp src/db/migrations/*.sql dist/db/migrations/

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files including lockfile for reproducible builds
COPY frontend/package*.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG EXPO_PUBLIC_API_URL=/api/v1
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

# Remove expo-web-browser from plugins for web build (causes issues with New Architecture in Docker)
# The plugin is only needed for native iOS/Android builds
RUN sed -i 's/"expo-web-browser"//g' app.json && \
    sed -i 's/,,/,/g' app.json && \
    sed -i 's/\[, /[/g' app.json && \
    sed -i 's/, \]/]/g' app.json

RUN npx expo export --platform web

# Stage 3: Production image
FROM node:20-alpine AS production

# Create non-root user (use 1001 since 1000 is taken by node user in Alpine)
RUN addgroup -g 1001 -S feeds && adduser -u 1001 -S feeds -G feeds

WORKDIR /app

# Install nginx and wget (for healthcheck)
RUN apk add --no-cache nginx wget

# Setup nginx directories for non-root operation
RUN mkdir -p /var/lib/nginx/tmp/client_body \
    /var/lib/nginx/tmp/proxy \
    /var/lib/nginx/tmp/fastcgi \
    /var/lib/nginx/tmp/uwsgi \
    /var/lib/nginx/tmp/scgi \
    /var/log/nginx \
    /run/nginx && \
    chown -R feeds:feeds /var/lib/nginx /var/log/nginx /run/nginx

# Copy backend build
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directory with correct ownership
RUN mkdir -p /data && chown -R feeds:feeds /data /app

# Switch to non-root user
USER feeds

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/health || exit 1

# Environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/feeds.db
ENV PORT=3001

ENTRYPOINT ["/entrypoint.sh"]
CMD []
