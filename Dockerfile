# ── Stage 1: Build client ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency install
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies (including devDependencies for build)
RUN npm install --workspace=client --workspace=server

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN npm run build --workspace=client

# ── Stage 2: Production image ────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY server/package.json ./server/

# Install production dependencies only
RUN npm install --workspace=server --omit=dev

# Copy server source
COPY server/src/ ./server/src/
COPY server/db/schema.sql ./server/db/

# Copy built client
COPY --from=builder /app/client/dist/ ./client/dist/

# Copy service worker to client dist
COPY client/public/sw.js ./client/dist/

# Copy test audio files for seeding (already in server/uploads/test_audio/)
COPY server/uploads/test_audio/ ./server/uploads/test_audio/

# Create writable directories
RUN mkdir -p /tmp/resonaite ./server/uploads/generated ./server/uploads/processed

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# JWT_SECRET is intentionally NOT baked into the image.
# It must be supplied at runtime, e.g.:
#   docker run -e JWT_SECRET="$(openssl rand -hex 32)" ...
# The server should fail fast on startup if it is unset.

EXPOSE 8080

CMD ["node", "server/src/index.js"]
