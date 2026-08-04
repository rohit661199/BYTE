# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native sqlite compilation if needed
RUN apk add --no-allowed-untrusted --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Stage 2: Production Execution ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DB_PATH=./data/exchange.db

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create data directory for SQLite database file
RUN mkdir -p data

EXPOSE 5000

CMD ["node", "dist/index.js"]
