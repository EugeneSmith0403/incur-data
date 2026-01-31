#!/bin/bash

# Connection Test Script
# Tests connectivity to all required services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Print functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test function with timeout
test_service() {
    local name=$1
    local command=$2
    local timeout=${3:-5}
    
    print_info "Testing $name..."
    
    if timeout $timeout bash -c "$command" > /dev/null 2>&1; then
        print_success "$name is reachable"
        return 0
    else
        print_error "$name is not reachable"
        return 1
    fi
}

# Main test
main() {
    ENV_FILE=${1:-.env}
    
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file '$ENV_FILE' not found"
        echo "Usage: $0 [ENV_FILE]"
        exit 1
    fi
    
    print_header "Connection Test Suite"
    print_info "Loading environment from: $ENV_FILE"
    
    # Load environment
    set -a
    source "$ENV_FILE"
    set +a
    
    echo ""
    
    # ============================================
    # Test ClickHouse
    # ============================================
    print_header "ClickHouse"
    
    if [ -n "$CLICKHOUSE_URL" ]; then
        print_info "URL: $CLICKHOUSE_URL"
        test_service "ClickHouse" "curl -f -s '$CLICKHOUSE_URL/?query=SELECT%201'"
        
        # Try to connect to database
        if [ -n "$CLICKHOUSE_DATABASE" ]; then
            print_info "Testing database: $CLICKHOUSE_DATABASE"
            test_service "ClickHouse Database" \
                "curl -f -s '$CLICKHOUSE_URL/?query=SELECT%201%20FROM%20system.databases%20WHERE%20name%3D%27$CLICKHOUSE_DATABASE%27%20LIMIT%201'"
        fi
    else
        print_error "CLICKHOUSE_URL not set"
    fi
    
    # ============================================
    # Test Redis
    # ============================================
    print_header "Redis"
    
    if [ -n "$REDIS_URL" ]; then
        print_info "URL: $REDIS_URL"
        
        if command -v redis-cli > /dev/null 2>&1; then
            test_service "Redis" "redis-cli -u '$REDIS_URL' ping"
            
            # Test write/read
            print_info "Testing write/read..."
            TEST_KEY="test:connection:$(date +%s)"
            if redis-cli -u "$REDIS_URL" SET "$TEST_KEY" "test" EX 10 > /dev/null 2>&1 && \
               redis-cli -u "$REDIS_URL" GET "$TEST_KEY" > /dev/null 2>&1; then
                print_success "Redis write/read works"
                redis-cli -u "$REDIS_URL" DEL "$TEST_KEY" > /dev/null 2>&1
                ((PASSED++))
            else
                print_error "Redis write/read failed"
                ((FAILED++))
            fi
        else
            print_error "redis-cli not installed, cannot test Redis"
        fi
    else
        print_error "REDIS_URL not set"
    fi
    
    # ============================================
    # Test RabbitMQ
    # ============================================
    print_header "RabbitMQ"
    
    if [ -n "$RABBITMQ_URL" ]; then
        print_info "URL: $RABBITMQ_URL"
        
        # Test AMQP connection (if possible)
        # For now, just test management API
        print_info "Testing management API (port 15672)..."
        test_service "RabbitMQ Management" "curl -f -s -u guest:guest http://localhost:15672/api/overview" 10
        
        # Check if queue exists
        if [ -n "$RABBITMQ_QUEUE_NAME" ]; then
            print_info "Checking queue: $RABBITMQ_QUEUE_NAME"
            if curl -f -s -u guest:guest "http://localhost:15672/api/queues/%2F/$RABBITMQ_QUEUE_NAME" > /dev/null 2>&1; then
                print_success "Queue '$RABBITMQ_QUEUE_NAME' exists"
                ((PASSED++))
            else
                print_info "Queue '$RABBITMQ_QUEUE_NAME' does not exist yet (will be created on first use)"
            fi
        fi
    else
        print_error "RABBITMQ_URL not set"
    fi
    
    # ============================================
    # Test Solana RPC
    # ============================================
    print_header "Solana RPC"
    
    if [ -n "$SOLANA_RPC_URL" ]; then
        print_info "URL: $SOLANA_RPC_URL"
        
        # Test basic connectivity
        test_service "Solana RPC" \
            "curl -f -s -X POST '$SOLANA_RPC_URL' -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getHealth\"}'" 10
        
        # Test getting slot
        print_info "Testing getSlot..."
        RESPONSE=$(curl -s -X POST "$SOLANA_RPC_URL" \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' 2>/dev/null)
        
        if [ -n "$RESPONSE" ] && echo "$RESPONSE" | grep -q "result"; then
            SLOT=$(echo "$RESPONSE" | grep -o '"result":[0-9]*' | grep -o '[0-9]*')
            print_success "Current slot: $SLOT"
            ((PASSED++))
        else
            print_error "Failed to get current slot"
            ((FAILED++))
        fi
        
        # Test program account (if DLN_PROGRAM_ID is set)
        if [ -n "$DLN_PROGRAM_ID" ]; then
            print_info "Testing program account: $DLN_PROGRAM_ID"
            RESPONSE=$(curl -s -X POST "$SOLANA_RPC_URL" \
                -H "Content-Type: application/json" \
                -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getAccountInfo\",\"params\":[\"$DLN_PROGRAM_ID\"]}" 2>/dev/null)
            
            if echo "$RESPONSE" | grep -q "result"; then
                print_success "Program account exists"
                ((PASSED++))
            else
                print_error "Program account not found or error"
                ((FAILED++))
            fi
        fi
    else
        print_error "SOLANA_RPC_URL not set"
    fi
    
    # ============================================
    # Test Solana WebSocket (if configured)
    # ============================================
    if [ -n "$SOLANA_WSS_URL" ]; then
        print_header "Solana WebSocket"
        print_info "URL: $SOLANA_WSS_URL"
        print_info "WebSocket connection test requires wscat or similar tool"
        print_info "Skipping WebSocket test (manual test recommended)"
    fi
    
    # ============================================
    # Test Jupiter API (if configured)
    # ============================================
    if [ -n "$JUPITER_API_KEY" ]; then
        print_header "Jupiter API"
        print_info "Testing price API..."
        
        # Test SOL price
        RESPONSE=$(curl -s "https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112" \
            -H "X-API-KEY: $JUPITER_API_KEY" 2>/dev/null)
        
        if echo "$RESPONSE" | grep -q "So11111111111111111111111111111111111111112"; then
            print_success "Jupiter API key is valid"
            ((PASSED++))
            
            # Extract price if possible
            PRICE=$(echo "$RESPONSE" | grep -o '"price":"[0-9.]*"' | head -1 | grep -o '[0-9.]*')
            if [ -n "$PRICE" ]; then
                print_info "SOL price: \$$PRICE"
            fi
        else
            print_error "Jupiter API key is invalid or API is down"
            ((FAILED++))
        fi
    fi
    
    # ============================================
    # Summary
    # ============================================
    print_header "Test Summary"
    
    echo -e "${GREEN}✅ Passed: $PASSED${NC}"
    echo -e "${RED}❌ Failed: $FAILED${NC}"
    
    TOTAL=$((PASSED + FAILED))
    if [ $TOTAL -gt 0 ]; then
        SUCCESS_RATE=$((PASSED * 100 / TOTAL))
        echo -e "\n${BLUE}Success Rate: $SUCCESS_RATE%${NC}"
    fi
    
    echo ""
    
    if [ $FAILED -gt 0 ]; then
        print_error "Some tests failed"
        echo ""
        echo "Troubleshooting:"
        echo "1. Ensure all Docker services are running: docker-compose ps"
        echo "2. Check service logs: docker-compose logs [service-name]"
        echo "3. Verify environment variables in $ENV_FILE"
        echo "4. See ENV_CHECKLIST.md for detailed troubleshooting"
        exit 1
    else
        print_success "All tests passed!"
        echo ""
        echo "All services are reachable and responding. 🎉"
        exit 0
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [ENV_FILE]"
    echo ""
    echo "Tests connectivity to all configured services."
    echo ""
    echo "Arguments:"
    echo "  ENV_FILE    Path to environment file (default: .env)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Test with .env"
    echo "  $0 .env.prod                # Test production config"
    echo ""
    echo "Requirements:"
    echo "  - curl (for HTTP tests)"
    echo "  - redis-cli (for Redis tests)"
    echo ""
}

# Parse arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Check requirements
if ! command -v curl > /dev/null 2>&1; then
    echo "Error: curl is required but not installed"
    exit 1
fi

# Run tests
main "$@"
