#!/bin/bash

# Universal startup script for incur-data project
# Manages Docker containers (ClickHouse, Redis, RabbitMQ) and services (Indexer, Worker)

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
}

# Determine which docker-compose file to use
get_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${YELLOW}⚠️  docker-compose.dev.yml not found, using docker-compose.yml${NC}"
        COMPOSE_FILE="docker-compose.yml"
    fi
}

# Start Docker containers
start_containers() {
    echo -e "${BLUE}📦 Starting Docker services (ClickHouse, Redis, RabbitMQ)...${NC}"
    docker-compose -f $COMPOSE_FILE up -d rabbitmq redis clickhouse
}

# Wait for services to be healthy
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
    local max_attempts=60
    local attempt=0
    
    # Check RabbitMQ
    echo "   Checking RabbitMQ..."
    attempt=0
    until docker exec dln-rabbitmq-dev rabbitmq-diagnostics ping > /dev/null 2>&1; do
        printf '.'
        sleep 2
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo ""
            echo -e "${RED}   ❌ RabbitMQ failed to start after ${max_attempts} attempts${NC}"
            echo "   Try: docker logs dln-rabbitmq-dev"
            exit 1
        fi
    done
    echo -e "${GREEN}   ✅ RabbitMQ is ready${NC}"

    # Check Redis
    echo "   Checking Redis..."
    attempt=0
    until docker exec dln-redis-dev redis-cli ping > /dev/null 2>&1; do
        printf '.'
        sleep 2
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo ""
            echo -e "${RED}   ❌ Redis failed to start after ${max_attempts} attempts${NC}"
            echo "   Try: docker logs dln-redis-dev"
            exit 1
        fi
    done
    echo -e "${GREEN}   ✅ Redis is ready${NC}"

    # Check ClickHouse (using curl from host instead of wget inside container)
    echo "   Checking ClickHouse..."
    attempt=0
    until curl -s http://localhost:8123/ping > /dev/null 2>&1; do
        printf '.'
        sleep 2
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo ""
            echo -e "${RED}   ❌ ClickHouse failed to start after ${max_attempts} attempts${NC}"
            echo "   Try: docker logs dln-clickhouse-dev"
            echo "   Or check if port 8123 is already in use: lsof -i :8123"
            exit 1
        fi
    done
    echo -e "${GREEN}   ✅ ClickHouse is ready${NC}"
    
    echo ""
    echo -e "${GREEN}✅ All Docker services are healthy!${NC}"
}

# Show service endpoints
show_endpoints() {
    echo ""
    echo -e "${BLUE}Service endpoints:${NC}"
    echo "  📊 ClickHouse HTTP:  http://localhost:8123"
    echo "  📊 ClickHouse Native: localhost:9000"
    echo "  🔴 Redis:            localhost:6379"
    echo "  🐰 RabbitMQ:         localhost:5672"
    echo "  🐰 RabbitMQ UI:      http://localhost:15672 (guest/guest)"
    echo ""
}

# Run database migrations
run_migrations() {
    echo -e "${BLUE}🔄 Running database migrations...${NC}"
    
    # Check if migrations directory exists
    if [ ! -d "migrations" ]; then
        echo -e "${YELLOW}⚠️  Migrations directory not found, skipping migrations${NC}"
        return
    fi
    
    echo -e "${BLUE}   Applying SQL migrations directly...${NC}"
    
    # Run each migration file directly via clickhouse-client in Docker
    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            echo -e "${BLUE}   • Applying $filename${NC}"
            
            if docker exec -i dln-clickhouse-dev clickhouse-client --database=dln --multiquery < "$migration" 2>/dev/null; then
                echo -e "${GREEN}     ✓ $filename applied${NC}"
            else
                # Ignore errors - migrations might already be applied
                echo -e "${YELLOW}     ⚠ $filename skipped (may already be applied)${NC}"
            fi
        fi
    done
    
    echo -e "${GREEN}✅ Migrations processing completed${NC}"
    echo ""
}

# Clean all build artifacts and dependencies
clean_all() {
    echo -e "${BLUE}🧹 Cleaning all build artifacts and dependencies...${NC}"
    pnpm clean:all
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Install dependencies if needed
install_dependencies() {
    echo -e "${BLUE}📥 Installing dependencies...${NC}"
    pnpm install
}

# Build packages
build_packages() {
    echo -e "${BLUE}🏗️  Building packages...${NC}"
    # Clean TypeScript build info to force rebuild
    find packages -name "tsconfig.tsbuildinfo" -delete 2>/dev/null || true
    pnpm --filter @incur-data/dtos build
    pnpm --filter @incur-data/olap-types build
    pnpm --filter @incur-data/rabbitmq build
    pnpm --filter @incur-data/tx-parsing build
}

# Build indexer and worker
build_services() {
    echo -e "${BLUE}🏗️  Building indexer and worker...${NC}"
    pnpm --filter @incur-data/indexer build
    pnpm --filter @incur-data/worker build
}

# Start indexer and worker
start_services() {
    # Check for environment files
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}⚠️  Warning: .env file not found. Using default configuration.${NC}"
        echo "   Copy env.example to .env if you need custom configuration."
    fi

    echo ""
    echo -e "${BLUE}Starting services:${NC}"
    echo "  🔍 Indexer SRC - processing SRC program (src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4)"
    echo "  🔍 Indexer DST - processing DST program (dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo)"
    echo "  ⚙️  Worker - processing aggregations"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""

    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Start indexer instances (SRC and DST) and worker in dev mode
    echo -e "${BLUE}Starting indexer (SRC)...${NC}"
    pnpm --filter @incur-data/indexer dev:src > indexer-src.log 2>&1 &
    INDEXER_SRC_PID=$!
    echo -e "${GREEN}  ✓ Indexer SRC started (PID: $INDEXER_SRC_PID)${NC}"
    echo -e "${BLUE}  📋 Logs: tail -f indexer-src.log${NC}"

    echo ""
    echo -e "${BLUE}Starting indexer (DST)...${NC}"
    pnpm --filter @incur-data/indexer dev:dst > indexer-dst.log 2>&1 &
    INDEXER_DST_PID=$!
    echo -e "${GREEN}  ✓ Indexer DST started (PID: $INDEXER_DST_PID)${NC}"
    echo -e "${BLUE}  📋 Logs: tail -f indexer-dst.log${NC}"

    echo ""
    echo -e "${BLUE}Starting worker...${NC}"
    pnpm --filter @incur-data/worker dev > worker.log 2>&1 &
    WORKER_PID=$!
    echo -e "${GREEN}  ✓ Worker started (PID: $WORKER_PID)${NC}"
    echo -e "${BLUE}  📋 Logs: tail -f worker.log${NC}"
    echo ""

    # Wait a moment and check if processes are still running
    sleep 2
    if ! kill -0 $INDEXER_SRC_PID 2>/dev/null; then
        echo -e "${RED}  ❌ Indexer SRC process died. Check indexer-src.log for errors.${NC}"
    fi
    if ! kill -0 $INDEXER_DST_PID 2>/dev/null; then
        echo -e "${RED}  ❌ Indexer DST process died. Check indexer-dst.log for errors.${NC}"
    fi
    if ! kill -0 $WORKER_PID 2>/dev/null; then
        echo -e "${RED}  ❌ Worker process died. Check worker.log for errors.${NC}"
        echo -e "${YELLOW}  Common issues:${NC}"
        echo -e "${YELLOW}    - Missing required environment variables in .env${NC}"
        echo -e "${YELLOW}    - Services (RabbitMQ, Redis, ClickHouse) not running${NC}"
    else
        echo -e "${GREEN}✅ All services are running!${NC}"
    fi
    echo ""

    # Trap Ctrl+C to kill all processes
    trap "echo ''; echo -e '${YELLOW}Stopping services...${NC}'; kill $INDEXER_SRC_PID $INDEXER_DST_PID $WORKER_PID 2>/dev/null; echo -e '${BLUE}Docker containers are still running. Use \"./start.sh stop\" to stop them.${NC}'; exit 0" INT TERM

    # Wait for all processes
    wait
}

# Stop all Docker containers
stop_containers() {
    echo -e "${BLUE}📦 Stopping Docker containers...${NC}"
    docker-compose -f $COMPOSE_FILE down
    echo ""
    echo -e "${GREEN}✅ All services stopped!${NC}"
    echo ""
    echo "To start services again, run:"
    echo "  ./start.sh all       # Start everything"
    echo "  ./start.sh containers # Start only containers"
}

# Show help
show_help() {
    echo ""
    echo -e "${BLUE}🚀 incur-data Startup Script${NC}"
    echo ""
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  all               Start all services (containers + indexer + worker) [default]"
    echo "  containers        Start only Docker containers (ClickHouse, Redis, RabbitMQ)"
    echo "  migrate           Run database migrations only"
    echo "  clean             Clean all build artifacts and dependencies"
    echo "  stop              Stop all Docker containers"
    echo "  restart           Restart all Docker containers"
    echo "  status            Show status of Docker containers"
    echo "  logs              Show logs from Docker containers"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start.sh                  # Start everything (with clean)"
    echo "  ./start.sh all              # Start everything (with clean)"
    echo "  ./start.sh containers       # Start only infrastructure"
    echo "  ./start.sh clean            # Clean build artifacts"
    echo "  ./start.sh stop             # Stop all containers"
    echo "  ./start.sh logs             # View container logs"
    echo ""
    echo -e "${YELLOW}Tip:${NC} Use './start.sh containers' and then manually start indexer/worker"
    echo "     in separate terminals for better development experience."
    echo ""
}

# Show container status
show_status() {
    echo -e "${BLUE}📊 Container Status:${NC}"
    echo ""
    docker-compose -f $COMPOSE_FILE ps
}

# Show container logs
show_logs() {
    echo -e "${BLUE}📋 Container Logs:${NC}"
    echo ""
    docker-compose -f $COMPOSE_FILE logs -f
}

# Restart containers
restart_containers() {
    echo -e "${BLUE}🔄 Restarting Docker containers...${NC}"
    docker-compose -f $COMPOSE_FILE restart
    echo ""
    wait_for_services
    show_endpoints
}

# Main script logic
main() {
    local command=${1:-all}

    case $command in
        all)
            echo "🚀 Starting all services..."
            echo ""
            check_docker
            get_compose_file
            # Clean build artifacts (but keep node_modules)
            echo -e "${BLUE}🧹 Cleaning build artifacts...${NC}"
            pnpm clean
            # Install dependencies FIRST before building
            install_dependencies
            start_containers
            wait_for_services
            show_endpoints
            build_packages
            run_migrations
            build_services
            echo ""
            echo -e "${GREEN}✅ Build complete!${NC}"
            start_services
            ;;
        
        containers)
            echo "🚀 Starting infrastructure containers..."
            echo ""
            check_docker
            get_compose_file
            start_containers
            wait_for_services
            show_endpoints
            echo "To stop containers, run: ./start.sh stop"
            ;;
        
        migrate)
            echo "🔄 Running database migrations..."
            echo ""
            check_docker
            get_compose_file
            
            # Check if ClickHouse is running
            if ! docker ps | grep -q dln-clickhouse-dev; then
                echo -e "${RED}❌ ClickHouse container is not running${NC}"
                echo "   Start containers first: ./start.sh containers"
                exit 1
            fi
            
            run_migrations
            echo -e "${GREEN}✅ Migration command completed${NC}"
            ;;
        
        clean)
            echo "🧹 Cleaning build artifacts..."
            echo ""
            clean_all
            echo ""
            echo -e "${GREEN}✅ Clean command completed${NC}"
            echo ""
            echo "Next steps:"
            echo "  ./start.sh all         # Rebuild and start everything"
            echo "  ./start.sh containers  # Start only containers"
            ;;
        
        stop)
            echo "🛑 Stopping all services..."
            echo ""
            get_compose_file
            stop_containers
            ;;
        
        restart)
            echo "🔄 Restarting services..."
            echo ""
            check_docker
            get_compose_file
            restart_containers
            ;;
        
        status)
            get_compose_file
            show_status
            ;;
        
        logs)
            get_compose_file
            show_logs
            ;;
        
        help|--help|-h)
            show_help
            ;;
        
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
