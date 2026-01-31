# Makefile for incur-data project
# Provides convenient shortcuts for common operations

.PHONY: help install build test lint clean deploy

# Default target
help:
	@echo "Available commands:"
	@echo "  make install          - Install dependencies"
	@echo "  make build           - Build all packages"
	@echo "  make test            - Run all tests"
	@echo "  make lint            - Run linters"
	@echo "  make clean           - Clean build artifacts"
	@echo ""
	@echo "Docker Compose commands:"
	@echo "  make docker-build    - Build Docker images"
	@echo "  make docker-up       - Start services"
	@echo "  make docker-down     - Stop services"
	@echo "  make docker-logs     - View logs"
	@echo "  make docker-ps       - List containers"
	@echo ""
	@echo "Kubernetes commands:"
	@echo "  make k8s-deploy      - Deploy to Kubernetes"
	@echo "  make k8s-rollback    - Rollback Kubernetes deployment"
	@echo "  make k8s-status      - Show Kubernetes status"
	@echo ""
	@echo "CI commands:"
	@echo "  make ci-local        - Run CI checks locally"
	@echo "  make security-scan   - Run security scans"

# Development
install:
	pnpm install

build:
	pnpm build

test:
	pnpm test:unit

test-all:
	pnpm test

test-integration:
	pnpm test:integration

lint:
	pnpm lint
	pnpm format --check

format:
	pnpm format

type-check:
	pnpm type-check

clean:
	pnpm clean
	rm -rf node_modules
	rm -rf dist
	rm -rf coverage
	find . -name "*.tsbuildinfo" -delete

# Docker Compose
docker-build:
	docker-compose -f docker-compose.prod.yml build

docker-up:
	@if [ ! -f env.prod ]; then \
		echo "Error: env.prod not found. Copy from env.prod.example and fill in values."; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml --env-file env.prod up -d

docker-down:
	docker-compose -f docker-compose.prod.yml down

docker-logs:
	docker-compose -f docker-compose.prod.yml logs -f

docker-ps:
	docker-compose -f docker-compose.prod.yml ps

docker-restart:
	docker-compose -f docker-compose.prod.yml restart

docker-clean:
	docker-compose -f docker-compose.prod.yml down -v
	docker system prune -af

# Kubernetes
k8s-deploy:
	./scripts/deploy.sh kubernetes

k8s-rollback:
	./scripts/deploy.sh rollback

k8s-status:
	kubectl get all -n incur-data
	kubectl get ingress -n incur-data

k8s-logs:
	kubectl logs -f deployment/api -n incur-data

k8s-describe:
	kubectl describe pods -n incur-data

k8s-clean:
	kubectl delete namespace incur-data

# CI/CD
ci-local: lint type-check test-all build
	@echo "✅ Local CI checks passed!"

security-scan:
	pnpm audit
	@echo "Running Trivy scan on Docker images..."
	@for app in api worker indexer web; do \
		echo "Scanning $$app..."; \
		docker build -f apps/$$app/Dockerfile.prod -t incur-data/$$app:latest . || true; \
		trivy image incur-data/$$app:latest || true; \
	done

# Database
db-start:
	docker-compose -f docker-compose.clickhouse.yml up -d

db-stop:
	docker-compose -f docker-compose.clickhouse.yml down

db-logs:
	docker-compose -f docker-compose.clickhouse.yml logs -f

migrate:
	pnpm migrate

# Monitoring
logs-api:
	docker-compose -f docker-compose.prod.yml logs -f api

logs-worker:
	docker-compose -f docker-compose.prod.yml logs -f worker

logs-indexer:
	docker-compose -f docker-compose.prod.yml logs -f indexer-history indexer-realtime

logs-all:
	docker-compose -f docker-compose.prod.yml logs -f

# Health checks
health-check:
	@echo "Checking API health..."
	@curl -f http://localhost:3000/health || echo "❌ API not healthy"
	@echo ""
	@echo "Checking ClickHouse..."
	@curl -f http://localhost:8123/ping || echo "❌ ClickHouse not healthy"
	@echo ""
	@echo "Checking Redis..."
	@redis-cli ping || echo "❌ Redis not healthy"

# Quick start
dev:
	pnpm dev

start: docker-up

stop: docker-down

restart: docker-restart

status: docker-ps

# Production deployment
deploy-prod: ci-local docker-build docker-up
	@echo "✅ Production deployment complete!"
	@echo "Run 'make health-check' to verify services"

# Backup
backup:
	@echo "Creating backups..."
	@mkdir -p backups
	@docker-compose -f docker-compose.prod.yml exec -T clickhouse clickhouse-backup create backup-$(shell date +%Y%m%d-%H%M%S)
	@docker-compose -f docker-compose.prod.yml exec -T redis redis-cli BGSAVE
	@echo "✅ Backups created"

# Version info
version:
	@echo "Node version: $(shell node --version)"
	@echo "pnpm version: $(shell pnpm --version)"
	@echo "Docker version: $(shell docker --version)"
	@echo "kubectl version: $(shell kubectl version --client --short 2>/dev/null || echo 'Not installed')"
