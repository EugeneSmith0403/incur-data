# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./
COPY tsconfig.json ./

# Copy all packages and apps
COPY packages ./packages
COPY apps/indexer ./apps/indexer

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages first, then indexer
RUN pnpm --filter @incur-data/dtos build
RUN pnpm --filter @incur-data/rabbitmq build
RUN pnpm --filter @incur-data/indexer build

# Production stage
FROM node:20-alpine AS production

RUN npm install -g pnpm@8.14.0

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/indexer/dist ./apps/indexer/dist
COPY --from=base /app/apps/indexer/package.json ./apps/indexer/package.json

WORKDIR /app/apps/indexer

EXPOSE 8080

CMD ["node", "dist/index.js"]
