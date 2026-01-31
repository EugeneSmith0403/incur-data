#!/bin/bash

# Start dev environment for incur-data project
# This script starts only the web and API services for demonstration

set -e

echo "🚀 Starting dev environment..."
echo ""

# Check if Docker services are running
echo "📦 Checking Docker services..."
if ! docker ps | grep -q "dln-clickhouse"; then
    echo "Starting Docker services (ClickHouse, Redis, RabbitMQ)..."
    docker-compose up -d rabbitmq redis clickhouse
    echo "Waiting for services to be healthy..."
    sleep 20
fi

echo "✅ Docker services are running"
echo ""

# Check Node modules
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    pnpm install
fi

echo "🏗️  Building packages..."
pnpm --filter @incur-data/dtos build
pnpm --filter @incur-data/olap-types build
pnpm --filter @incur-data/rabbitmq build
pnpm --filter @incur-data/tx-parsing build
pnpm --filter @incur-data/ui build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting services..."
echo "  - API will be available at http://localhost:3000"
echo "  - Web Dashboard will be available at http://localhost:3001"
echo "  - Indexer SRC will process SRC program (src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4)"
echo "  - Indexer DST will process DST program (dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo)"
echo "  - Worker will start processing aggregations"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Use environment variables from root .env file
export $(cat .env | grep -v '^#' | xargs)

# Start all services in parallel using pnpm
pnpm --filter @incur-data/api dev &
API_PID=$!

pnpm --filter @incur-data/web dev &
WEB_PID=$!

pnpm --filter @incur-data/indexer dev:src &
INDEXER_SRC_PID=$!

pnpm --filter @incur-data/indexer dev:dst &
INDEXER_DST_PID=$!

pnpm --filter @incur-data/worker dev &
WORKER_PID=$!

# Trap Ctrl+C to kill all processes
trap "echo ''; echo 'Stopping services...'; kill $API_PID $WEB_PID $INDEXER_SRC_PID $INDEXER_DST_PID $WORKER_PID 2>/dev/null; exit 0" INT TERM

# Wait for all processes
wait
