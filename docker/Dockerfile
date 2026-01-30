# Production Dockerfile for AgentPane
#
# Multi-stage build: deps → build → runtime
#
# Usage:
#   docker build -f docker/Dockerfile -t agentpane:latest .
#   docker run -p 3001:3001 -v agentpane-data:/app/data agentpane:latest

# ─── Stage 1: Install dependencies ───
FROM oven/bun:1.3.6-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* ./
COPY agent-runner/package.json agent-runner/package-lock.json* ./agent-runner/

RUN bun install --frozen-lockfile --production=false
RUN cd agent-runner && npm install --ignore-scripts

# ─── Stage 2: Build application ───
FROM oven/bun:1.3.6-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/agent-runner/node_modules ./agent-runner/node_modules
COPY . .

# Build frontend + typecheck + agent runner
RUN bun run build

# ─── Stage 3: Production runtime ───
FROM oven/bun:1.3.6-alpine AS runtime

RUN apk add --no-cache git tini

WORKDIR /app

# Copy built assets and production deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/agent-runner/dist ./agent-runner/dist
COPY --from=build /app/agent-runner/package.json ./agent-runner/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R bun:bun /app/data

# Non-root user
USER bun

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/healthz || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]

ENV NODE_ENV=production
ENV DB_PATH=/app/data/agentpane.db

CMD ["bun", "src/server/api.ts"]
