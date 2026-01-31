# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

# Copy all packages and apps
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages first, then API
RUN pnpm --filter @incur-data/dtos build
RUN pnpm --filter @incur-data/olap-types build
RUN pnpm --filter @incur-data/api build

# Production stage
FROM node:20-alpine AS production

RUN npm install -g pnpm@8.14.0

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/index.js"]
