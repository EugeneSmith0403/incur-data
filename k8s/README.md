# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the incur-data platform to a Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` CLI configured
- Access to a container registry (GitHub Container Registry, Docker Hub, AWS ECR, etc.)
- Ingress controller (NGINX Ingress Controller or AWS Load Balancer Controller)
- Optional: cert-manager for automatic TLS certificates

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets

**IMPORTANT:** Never commit secrets to version control!

```bash
# Method 1: Create secrets directly
kubectl create secret generic incur-data-secrets \
  --from-literal=SOLANA_RPC_URL='https://api.mainnet-beta.solana.com' \
  --from-literal=SOLANA_WSS_URL='wss://api.mainnet-beta.solana.com' \
  --from-literal=DLN_PROGRAM_ID='your_program_id' \
  --from-literal=RABBITMQ_USER='admin' \
  --from-literal=RABBITMQ_PASSWORD='secure-password' \
  --from-literal=RABBITMQ_URL='amqp://admin:secure-password@rabbitmq:5672' \
  --from-literal=REDIS_PASSWORD='secure-password' \
  --from-literal=REDIS_URL='redis://:secure-password@redis:6379' \
  --from-literal=CLICKHOUSE_PASSWORD='secure-password' \
  --from-literal=CLICKHOUSE_URL='http://clickhouse:8123' \
  -n incur-data

# Method 2: Create image pull secret for private registry
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  -n incur-data
```

### 3. Apply ConfigMaps

```bash
kubectl apply -f configmap.yaml
```

### 4. Deploy Infrastructure Services

```bash
# Deploy in order (wait for each to be ready)
kubectl apply -f rabbitmq.yaml
kubectl apply -f redis.yaml
kubectl apply -f clickhouse.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=rabbitmq -n incur-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n incur-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=clickhouse -n incur-data --timeout=300s
```

### 5. Deploy Application Services

```bash
# Deploy indexers, workers, API, and web
kubectl apply -f indexer.yaml
kubectl apply -f worker.yaml
kubectl apply -f api.yaml
kubectl apply -f web.yaml

# Wait for deployments
kubectl wait --for=condition=available deployment --all -n incur-data --timeout=300s
```

### 6. Configure Ingress

Update `ingress.yaml` with your domain names, then:

```bash
kubectl apply -f ingress.yaml
```

### 7. Verify Deployment

```bash
# Check all pods
kubectl get pods -n incur-data

# Check services
kubectl get svc -n incur-data

# Check ingress
kubectl get ingress -n incur-data

# View logs
kubectl logs -f deployment/api -n incur-data
kubectl logs -f deployment/worker -n incur-data
```

## Deployment Order

Deploy services in this order to ensure dependencies are ready:

1. **namespace.yaml** - Create namespace
2. **secrets** - Create all secrets
3. **configmap.yaml** - Apply configuration
4. **rabbitmq.yaml** - Message queue
5. **redis.yaml** - Cache
6. **clickhouse.yaml** - Analytics database
7. **indexer.yaml** - Data indexers
8. **worker.yaml** - Background workers
9. **api.yaml** - REST API
10. **web.yaml** - Web frontend
11. **ingress.yaml** - External access

## Configuration

### Update Image Registry

Update the image references in deployment files:

```yaml
image: ghcr.io/your-org/incur-data/api:latest
```

Replace `your-org` with your GitHub organization or registry path.

### Scaling

Scale deployments manually:

```bash
kubectl scale deployment api --replicas=5 -n incur-data
kubectl scale deployment worker --replicas=10 -n incur-data
```

Or use HorizontalPodAutoscaler (already configured in manifests).

### Resource Limits

Adjust resource requests/limits based on your cluster capacity:

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

## Storage

### Persistent Volumes

The manifests use `storageClassName: standard`. Update this based on your cluster:

- **GKE**: `standard` or `standard-rwo`
- **EKS**: `gp3` or `gp2`
- **AKS**: `default` or `managed-premium`
- **Local/Minikube**: `standard`

### Storage Size

Adjust PVC sizes based on your needs:

- RabbitMQ: 10Gi (default)
- Redis: 5Gi (default)
- ClickHouse Data: 50Gi (increase for production)
- ClickHouse Logs: 10Gi

## Ingress Configuration

### NGINX Ingress Controller

Install if not already present:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

### cert-manager (for TLS)

Install cert-manager:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

Create ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Monitoring

### View Logs

```bash
# API logs
kubectl logs -f deployment/api -n incur-data

# Worker logs
kubectl logs -f deployment/worker -n incur-data

# All pods
kubectl logs -f -l app=api -n incur-data --all-containers=true
```

### Check Pod Status

```bash
kubectl get pods -n incur-data -w
kubectl describe pod <pod-name> -n incur-data
```

### Port Forwarding (for debugging)

```bash
# API
kubectl port-forward svc/api 3000:3000 -n incur-data

# Web
kubectl port-forward svc/web 3001:3001 -n incur-data

# RabbitMQ Management
kubectl port-forward svc/rabbitmq 15672:15672 -n incur-data
```

## Secrets Management

### Using Sealed Secrets

```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Create sealed secret
kubectl create secret generic incur-data-secrets \
  --from-literal=REDIS_PASSWORD='password' \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secrets.yaml

# Apply sealed secret
kubectl apply -f sealed-secrets.yaml
```

### Using External Secrets Operator

See: https://external-secrets.io/

Supports:
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- HashiCorp Vault
- And more...

## Backup & Recovery

### ClickHouse Backup

```bash
# Create backup
kubectl exec -it statefulset/clickhouse -n incur-data -- \
  clickhouse-backup create backup-$(date +%Y%m%d)

# List backups
kubectl exec -it statefulset/clickhouse -n incur-data -- \
  clickhouse-backup list

# Restore backup
kubectl exec -it statefulset/clickhouse -n incur-data -- \
  clickhouse-backup restore backup-20240126
```

### Redis Backup

```bash
# Trigger RDB save
kubectl exec -it statefulset/redis -n incur-data -- redis-cli BGSAVE

# Copy RDB file
kubectl cp incur-data/redis-0:/data/dump.rdb ./backup/redis-dump.rdb
```

## Cleanup

```bash
# Delete all resources
kubectl delete -f .

# Delete namespace (removes everything)
kubectl delete namespace incur-data

# Delete PVCs (persistent data)
kubectl delete pvc --all -n incur-data
```

## Troubleshooting

### Pod Not Starting

```bash
kubectl describe pod <pod-name> -n incur-data
kubectl logs <pod-name> -n incur-data
```

### Service Not Accessible

```bash
kubectl get svc -n incur-data
kubectl get endpoints -n incur-data
```

### Ingress Not Working

```bash
kubectl describe ingress -n incur-data
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Database Connection Issues

```bash
# Test ClickHouse
kubectl exec -it deployment/api -n incur-data -- \
  wget -qO- http://clickhouse:8123/ping

# Test Redis
kubectl exec -it deployment/api -n incur-data -- \
  nc -zv redis 6379

# Test RabbitMQ
kubectl exec -it deployment/worker -n incur-data -- \
  nc -zv rabbitmq 5672
```

## Production Considerations

1. **High Availability**: Run multiple replicas of stateful services
2. **Monitoring**: Install Prometheus & Grafana for metrics
3. **Logging**: Use ELK/EFK stack or cloud logging
4. **Secrets**: Use external secrets management
5. **Backups**: Implement automated backup solutions
6. **Resource Limits**: Set appropriate CPU/memory limits
7. **Network Policies**: Restrict pod-to-pod communication
8. **Pod Security**: Enable Pod Security Standards
9. **Image Scanning**: Scan images for vulnerabilities
10. **Disaster Recovery**: Document and test DR procedures

## Support

For issues or questions:
- Check pod logs: `kubectl logs <pod-name> -n incur-data`
- Check events: `kubectl get events -n incur-data --sort-by='.lastTimestamp'`
- Review documentation in the main README
