# Multi-stage build for optimized image size
FROM node:20-alpine AS builder

# Enable corepack to use pnpm
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Enable corepack to use pnpm
RUN corepack enable

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
