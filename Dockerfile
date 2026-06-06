# Stage 1: Build
FROM node:22-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (with native module builds)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the SvelteKit app
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 2: Runtime
FROM node:22-slim AS runtime

WORKDIR /app

# Install only what's needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built app and production dependencies
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Create data directory
RUN mkdir -p /data && chown -R node:node /data

# Use non-root user
USER node

# Configuration
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV DATABASE_URL=/data/crumbs.db
ENV PORT=3000
ENV ORIGIN=http://localhost:3000

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "fetch('http://localhost:3000/login').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "build"]
