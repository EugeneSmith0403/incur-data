#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="incur-data"
REGISTRY="ghcr.io"
IMAGE_PREFIX="your-org/incur-data"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    log_info "Prerequisites OK"
}

deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Create namespace
    log_info "Creating namespace..."
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Check if secrets exist
    if ! kubectl get secret incur-data-secrets -n $NAMESPACE &> /dev/null; then
        log_error "Secrets not found! Please create secrets first:"
        log_error "  kubectl create secret generic incur-data-secrets \\"
        log_error "    --from-literal=SOLANA_RPC_URL='...' \\"
        log_error "    --from-literal=RABBITMQ_PASSWORD='...' \\"
        log_error "    --from-literal=REDIS_PASSWORD='...' \\"
        log_error "    --from-literal=CLICKHOUSE_PASSWORD='...' \\"
        log_error "    -n $NAMESPACE"
        exit 1
    fi
    
    # Apply ConfigMap
    log_info "Applying ConfigMap..."
    kubectl apply -f k8s/configmap.yaml
    
    # Deploy infrastructure
    log_info "Deploying infrastructure services..."
    kubectl apply -f k8s/rabbitmq.yaml
    kubectl apply -f k8s/redis.yaml
    kubectl apply -f k8s/clickhouse.yaml
    
    # Wait for infrastructure
    log_info "Waiting for infrastructure to be ready..."
    kubectl wait --for=condition=ready pod -l app=rabbitmq -n $NAMESPACE --timeout=300s || log_warn "RabbitMQ not ready"
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s || log_warn "Redis not ready"
    kubectl wait --for=condition=ready pod -l app=clickhouse -n $NAMESPACE --timeout=300s || log_warn "ClickHouse not ready"
    
    # Update image tags
    log_info "Updating image tags to $IMAGE_TAG..."
    for app in api worker indexer web; do
        sed -i.bak "s|image:.*/$app:.*|image: $REGISTRY/$IMAGE_PREFIX/$app:$IMAGE_TAG|g" k8s/$app.yaml
        rm -f k8s/$app.yaml.bak
    done
    
    # Deploy applications
    log_info "Deploying application services..."
    kubectl apply -f k8s/indexer.yaml
    kubectl apply -f k8s/worker.yaml
    kubectl apply -f k8s/api.yaml
    kubectl apply -f k8s/web.yaml
    
    # Wait for applications
    log_info "Waiting for applications to be ready..."
    kubectl wait --for=condition=available deployment --all -n $NAMESPACE --timeout=600s
    
    # Apply ingress
    log_info "Applying ingress..."
    kubectl apply -f k8s/ingress.yaml
    
    # Show status
    log_info "Deployment complete! Status:"
    kubectl get pods -n $NAMESPACE
    kubectl get svc -n $NAMESPACE
    kubectl get ingress -n $NAMESPACE
}

deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Check if env file exists
    if [ ! -f "env.prod" ]; then
        log_error "env.prod file not found! Please create it from env.prod.example"
        exit 1
    fi
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f docker-compose.prod.yml --env-file env.prod pull
    
    # Deploy
    log_info "Starting services..."
    docker-compose -f docker-compose.prod.yml --env-file env.prod up -d --remove-orphans
    
    # Show status
    log_info "Deployment complete! Status:"
    docker-compose -f docker-compose.prod.yml --env-file env.prod ps
}

rollback_kubernetes() {
    log_info "Rolling back Kubernetes deployment..."
    
    kubectl rollout undo deployment/api -n $NAMESPACE
    kubectl rollout undo deployment/worker -n $NAMESPACE
    kubectl rollout undo deployment/web -n $NAMESPACE
    kubectl rollout undo deployment/indexer-history -n $NAMESPACE
    kubectl rollout undo deployment/indexer-realtime -n $NAMESPACE
    
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/api -n $NAMESPACE
    kubectl rollout status deployment/worker -n $NAMESPACE
    
    log_info "Rollback complete!"
}

show_logs() {
    local service=$1
    
    if [ "$DEPLOY_METHOD" = "kubernetes" ]; then
        kubectl logs -f deployment/$service -n $NAMESPACE
    else
        docker-compose -f docker-compose.prod.yml --env-file env.prod logs -f $service
    fi
}

health_check() {
    log_info "Running health checks..."
    
    if [ "$DEPLOY_METHOD" = "kubernetes" ]; then
        # Check pod status
        if kubectl get pods -n $NAMESPACE | grep -v Running | grep -v Completed | grep -v NAME; then
            log_error "Some pods are not running!"
            return 1
        fi
        
        # Check API health
        API_POD=$(kubectl get pod -l app=api -n $NAMESPACE -o jsonpath="{.items[0].metadata.name}")
        if kubectl exec $API_POD -n $NAMESPACE -- wget -qO- http://localhost:3000/health > /dev/null 2>&1; then
            log_info "API health check passed"
        else
            log_error "API health check failed"
            return 1
        fi
    else
        # Check if all containers are running
        if docker-compose -f docker-compose.prod.yml --env-file env.prod ps | grep Exit; then
            log_error "Some containers have exited!"
            return 1
        fi
        
        # Check API health
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log_info "API health check passed"
        else
            log_error "API health check failed"
            return 1
        fi
    fi
    
    log_info "All health checks passed!"
}

# Main script
main() {
    local command=${1:-}
    
    case "$command" in
        k8s|kubernetes)
            export DEPLOY_METHOD="kubernetes"
            check_prerequisites
            deploy_kubernetes
            health_check
            ;;
        compose|docker-compose)
            export DEPLOY_METHOD="docker-compose"
            check_prerequisites
            deploy_docker_compose
            health_check
            ;;
        rollback)
            export DEPLOY_METHOD="kubernetes"
            check_prerequisites
            rollback_kubernetes
            ;;
        logs)
            local service=${2:-api}
            show_logs $service
            ;;
        health)
            export DEPLOY_METHOD=${2:-kubernetes}
            health_check
            ;;
        *)
            echo "Usage: $0 {k8s|compose|rollback|logs|health}"
            echo ""
            echo "Commands:"
            echo "  k8s, kubernetes       Deploy to Kubernetes"
            echo "  compose               Deploy with Docker Compose"
            echo "  rollback              Rollback Kubernetes deployment"
            echo "  logs <service>        Show logs for a service"
            echo "  health <method>       Run health checks"
            echo ""
            echo "Environment variables:"
            echo "  IMAGE_TAG             Docker image tag (default: latest)"
            echo "  NAMESPACE             Kubernetes namespace (default: incur-data)"
            echo "  REGISTRY              Docker registry (default: ghcr.io)"
            echo "  IMAGE_PREFIX          Image prefix (default: your-org/incur-data)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
