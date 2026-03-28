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
ENV JWT_SECRET=resonaite-prod-secret-change-in-env

EXPOSE 8080

CMD ["node", "server/src/index.js"]
