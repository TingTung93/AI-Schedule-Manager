# Multi-stage build for production optimization
# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps for compatibility
RUN npm ci --legacy-peer-deps --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Production environment
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init curl

# Create custom nginx main configuration for non-root user
RUN echo -e "pid /run/nginx.pid;\nuser nginx;\nevents {\n  worker_connections 1024;\n}\nhttp {\n  include /etc/nginx/mime.types;\n  include /etc/nginx/conf.d/*.conf;\n}" > /etc/nginx/nginx.conf

# Copy custom nginx server configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set permissions
RUN chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d && \
    mkdir -p /run/nginx && \
    chown -R nextjs:nodejs /run/nginx && \
    touch /run/nginx.pid && \
    chown nextjs:nodejs /run/nginx.pid

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 80

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]