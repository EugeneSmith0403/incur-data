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
COPY apps/web ./apps/web

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages first, then web
RUN pnpm --filter @incur-data/dtos build
RUN pnpm --filter @incur-data/ui build
RUN pnpm --filter @incur-data/web build

# Production stage
FROM node:20-alpine AS production

RUN npm install -g pnpm@8.14.0

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/web/.output ./apps/web/.output
COPY --from=base /app/apps/web/package.json ./apps/web/package.json

WORKDIR /app/apps/web

EXPOSE 3001

ENV HOST=0.0.0.0
ENV PORT=3001

CMD ["node", ".output/server/index.mjs"]
