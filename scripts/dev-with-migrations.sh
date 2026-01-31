#!/bin/bash
set -e

echo "📦 Building shared packages..."
echo ""

# Build all packages in packages/ directory first
pnpm turbo build --filter="./packages/*"

echo ""
echo "🔄 Running database migrations..."

# Temporarily disable exit on error for migration handling
set +e

# Try to run migrations
MIGRATION_OUTPUT=$(pnpm migrate:up 2>&1)
MIGRATION_EXIT=$?

# Re-enable exit on error
set -e

if [ $MIGRATION_EXIT -ne 0 ]; then
  # Check if error is due to checksum mismatch
  if echo "$MIGRATION_OUTPUT" | grep -q "has been modified after being applied"; then
    echo "⚠️  Migration checksum mismatch detected, resetting database..."
    echo ""
    pnpm migrate reset --force
    echo ""
    echo "🔄 Applying migrations to fresh database..."
    pnpm migrate:up
  else
    echo "⚠️  Migrations failed, rebuilding all packages..."
    echo ""
    pnpm build
    echo ""
    echo "🔄 Retrying migrations..."
    pnpm migrate:up || echo "⚠️  No pending migrations or migration error"
  fi
else
  echo "$MIGRATION_OUTPUT"
fi

echo ""
echo "🚀 Starting dev servers..."
echo ""

# Cleanup function to kill all background processes on exit
cleanup() {
  echo ""
  echo "🛑 Stopping all dev servers..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start turbo dev for api, web, worker (excluding indexer)
pnpm turbo dev --filter=!@incur-data/indexer &

# Wait a moment for other services to start
sleep 2

echo ""
echo "🔄 Starting indexer instances..."
echo ""

# Start indexer for SRC program
echo "📡 Starting indexer (SRC)..."
cd apps/indexer && pnpm dev:src &

# Start indexer for DST program
echo "📡 Starting indexer (DST)..."
cd apps/indexer && pnpm dev:dst &

echo ""
echo "✅ All services started:"
echo "   - API, Web, Worker (via turbo)"
echo "   - Indexer SRC (src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4)"
echo "   - Indexer DST (dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo)"
echo ""

# Wait for all background processes
wait
