#!/bin/bash

# Environment Validation Script
# Validates required environment variables and tests connectivity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
SUCCESS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((SUCCESS++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if variable is set
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_required=${2:-true}
    
    if [ -z "$var_value" ]; then
        if [ "$is_required" = true ]; then
            print_error "$var_name is not set (REQUIRED)"
            return 1
        else
            print_warning "$var_name is not set (optional)"
            return 0
        fi
    else
        print_success "$var_name is set"
        return 0
    fi
}

# Check if URL is accessible
check_url() {
    local url=$1
    local name=$2
    
    if curl -f -s -o /dev/null --connect-timeout 5 "$url"; then
        print_success "$name is accessible"
        return 0
    else
        print_error "$name is not accessible at $url"
        return 1
    fi
}

# Main validation
main() {
    # Check if .env file exists
    ENV_FILE=${1:-.env}
    
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file '$ENV_FILE' not found"
        exit 1
    fi
    
    print_header "Loading Environment: $ENV_FILE"
    
    # Load environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    print_success "Environment file loaded"
    
    # ============================================
    # Check Common Variables
    # ============================================
    print_header "Common Variables"
    
    check_var "NODE_ENV" false
    check_var "LOG_LEVEL" false
    
    # ============================================
    # Check Solana Configuration
    # ============================================
    print_header "Solana Configuration"
    
    check_var "SOLANA_RPC_URL"
    check_var "SOLANA_WSS_URL" false
    check_var "SOLANA_COMMITMENT" false
    check_var "DLN_PROGRAM_ID"
    
    # Validate Solana RPC
    if [ -n "$SOLANA_RPC_URL" ]; then
        print_info "Testing Solana RPC connection..."
        if curl -f -s -X POST "$SOLANA_RPC_URL" \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' > /dev/null 2>&1; then
            print_success "Solana RPC is accessible"
        else
            print_error "Solana RPC is not accessible"
        fi
    fi
    
    # Validate DLN Program ID format
    if [ -n "$DLN_PROGRAM_ID" ]; then
        if [[ $DLN_PROGRAM_ID =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]]; then
            print_success "DLN_PROGRAM_ID format is valid"
        else
            print_warning "DLN_PROGRAM_ID format might be invalid (should be base58)"
        fi
    fi
    
    # ============================================
    # Check ClickHouse Configuration
    # ============================================
    print_header "ClickHouse Configuration"
    
    check_var "CLICKHOUSE_URL"
    check_var "CLICKHOUSE_DATABASE" false
    check_var "CLICKHOUSE_USERNAME" false
    check_var "CLICKHOUSE_PASSWORD" false
    
    # Test ClickHouse connectivity
    if [ -n "$CLICKHOUSE_URL" ]; then
        print_info "Testing ClickHouse connection..."
        if curl -f -s "$CLICKHOUSE_URL/?query=SELECT%201" > /dev/null 2>&1; then
            print_success "ClickHouse is accessible"
        else
            print_error "ClickHouse is not accessible"
        fi
    fi
    
    # ============================================
    # Check Redis Configuration
    # ============================================
    print_header "Redis Configuration"
    
    check_var "REDIS_URL"
    check_var "REDIS_PASSWORD" false
    check_var "REDIS_DB" false
    
    # Test Redis connectivity
    if [ -n "$REDIS_URL" ]; then
        print_info "Testing Redis connection..."
        if command -v redis-cli > /dev/null 2>&1; then
            if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
                print_success "Redis is accessible"
            else
                print_error "Redis is not accessible"
            fi
        else
            print_warning "redis-cli not found, skipping Redis connectivity test"
        fi
    fi
    
    # ============================================
    # Check RabbitMQ Configuration
    # ============================================
    print_header "RabbitMQ Configuration"
    
    check_var "RABBITMQ_URL"
    check_var "RABBITMQ_QUEUE_NAME" false
    check_var "RABBITMQ_EXCHANGE_NAME" false
    check_var "RABBITMQ_PREFETCH_COUNT" false
    
    # Test RabbitMQ connectivity
    if [ -n "$RABBITMQ_URL" ]; then
        print_info "Testing RabbitMQ connection..."
        # Extract host and port from URL
        RABBITMQ_MGMT_URL="http://localhost:15672/api/overview"
        if curl -f -s -u guest:guest "$RABBITMQ_MGMT_URL" > /dev/null 2>&1; then
            print_success "RabbitMQ management interface is accessible"
        else
            print_warning "RabbitMQ management interface is not accessible (might be expected)"
        fi
    fi
    
    # ============================================
    # Check Worker Configuration (if applicable)
    # ============================================
    if [ -n "$WORKER_ID" ] || [ -n "$JUPITER_API_KEY" ]; then
        print_header "Worker Configuration"
        
        check_var "WORKER_ID" false
        check_var "WORKER_CONCURRENCY" false
        check_var "WORKER_BATCH_SIZE" false
        check_var "WORKER_METRICS_PORT" false
        
        # Check Jupiter API
        check_var "JUPITER_API_KEY" false
        
        if [ -n "$JUPITER_API_KEY" ]; then
            print_info "Testing Jupiter API..."
            if curl -f -s "https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112" \
                -H "X-API-KEY: $JUPITER_API_KEY" > /dev/null 2>&1; then
                print_success "Jupiter API key is valid"
            else
                print_error "Jupiter API key is invalid or API is unreachable"
            fi
        fi
    fi
    
    # ============================================
    # Check Indexer Configuration (if applicable)
    # ============================================
    if [ -n "$INDEXER_PORT" ]; then
        print_header "Indexer Configuration"
        
        check_var "INDEXER_PORT" false
        check_var "INDEXER_BATCH_SIZE" false
        check_var "INDEXER_CONCURRENCY" false
    fi
    
    # ============================================
    # Check API Configuration (if applicable)
    # ============================================
    if [ -n "$API_PORT" ]; then
        print_header "API Configuration"
        
        check_var "API_PORT" false
        check_var "API_HOST" false
        check_var "API_CORS_ORIGIN" false
    fi
    
    # ============================================
    # Security Checks
    # ============================================
    if [ "$NODE_ENV" = "production" ]; then
        print_header "Security Checks (Production)"
        
        # Check for default passwords
        if [[ "$CLICKHOUSE_PASSWORD" == "CHANGE_ME_SECURE_PASSWORD" ]]; then
            print_error "CLICKHOUSE_PASSWORD is still using default value!"
        fi
        
        if [[ "$REDIS_PASSWORD" == "CHANGE_ME_SECURE_PASSWORD" ]]; then
            print_error "REDIS_PASSWORD is still using default value!"
        fi
        
        if [[ "$RABBITMQ_URL" == *"guest:guest"* ]]; then
            print_error "RABBITMQ_URL is still using guest credentials!"
        fi
        
        # Check CORS
        if [ "$API_CORS_ORIGIN" = "*" ]; then
            print_warning "API_CORS_ORIGIN is set to '*' in production"
        fi
        
        # Check if passwords are empty
        if [ -z "$CLICKHOUSE_PASSWORD" ]; then
            print_warning "CLICKHOUSE_PASSWORD is empty in production"
        fi
        
        if [ -z "$REDIS_PASSWORD" ]; then
            print_warning "REDIS_PASSWORD is empty in production"
        fi
    fi
    
    # ============================================
    # Summary
    # ============================================
    print_header "Validation Summary"
    
    echo -e "${GREEN}✅ Success: $SUCCESS${NC}"
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
    echo -e "${RED}❌ Errors: $ERRORS${NC}"
    
    echo ""
    
    if [ $ERRORS -gt 0 ]; then
        print_error "Validation failed with $ERRORS error(s)"
        echo ""
        echo "Please fix the errors and run validation again."
        echo "See ENV_VARIABLES.md for variable documentation."
        exit 1
    elif [ $WARNINGS -gt 0 ]; then
        print_warning "Validation completed with $WARNINGS warning(s)"
        echo ""
        echo "Review warnings before proceeding."
        exit 0
    else
        print_success "All validations passed!"
        echo ""
        echo "Your environment is properly configured. 🎉"
        exit 0
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [ENV_FILE]"
    echo ""
    echo "Validates environment configuration and tests connectivity."
    echo ""
    echo "Arguments:"
    echo "  ENV_FILE    Path to environment file (default: .env)"
    echo ""
    echo "Examples:"
    echo "  $0                                  # Validate .env"
    echo "  $0 .env.prod                        # Validate .env.prod"
    echo "  $0 .env.indexer.program1           # Validate indexer config"
    echo ""
}

# Parse arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run validation
main "$@"
