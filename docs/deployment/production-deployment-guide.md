# Athena Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Security Configuration](#security-configuration)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Kubernetes 1.25+ cluster
- kubectl configured with cluster access
- Helm 3.0+
- Docker Registry access
- cert-manager installed in cluster
- Prometheus/Grafana stack (optional but recommended)

### Resource Requirements
- **Minimum**: 3 nodes with 4 CPU, 8GB RAM each
- **Recommended**: 5 nodes with 8 CPU, 16GB RAM each
- **Storage**: 100GB+ persistent storage for Redis and logs
- **WASM Requirements**: 
  - Additional 2GB RAM per pod for WASM module loading
  - CPU with WASM support (x86_64 or ARM64)
  - Binaryen tools for WASM optimization (included in Docker image)

## Infrastructure Setup

### 1. Create Namespace
```bash
kubectl create namespace athena
kubectl label namespace athena monitoring=prometheus
```

### 2. Install Required Dependencies

#### cert-manager (for TLS certificates)
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

#### NGINX Ingress Controller
```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

## Security Configuration

### 1. Create Secrets

First, generate secure passwords:
```bash
# Generate passwords
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

echo "Redis Password: $REDIS_PASSWORD"
echo "JWT Secret: $JWT_SECRET"
echo "Session Secret: $SESSION_SECRET"
echo "Encryption Key: $ENCRYPTION_KEY"
```

Update the secrets file with your actual values:
```bash
# Edit k8s/secrets-production.yaml with your actual API keys and generated passwords
vim k8s/secrets-production.yaml
```

Apply secrets:
```bash
kubectl apply -f k8s/secrets-production.yaml -n athena
```

### 2. Configure Network Policies
```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: athena-network-policy
  namespace: athena
spec:
  podSelector:
    matchLabels:
      app: athena
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  - from:
    - podSelector:
        matchLabels:
          app: athena
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # For external API calls
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
EOF
```

## Deployment Steps

### 1. Build and Push Docker Image
```bash
# Build the optimized production image with WASM modules
docker build -t athena:v1.0.0 -f Dockerfile .

# The build process will:
# - Compile all Rust WASM modules
# - Optimize them with Binaryen (wasm-opt)
# - Bundle them into the Docker image

# Tag for your registry
docker tag athena:v1.0.0 your-registry.com/athena:v1.0.0

# Push to registry
docker push your-registry.com/athena:v1.0.0
```

### 2. Update Deployment Configuration

Update the image in your deployment:
```bash
# Edit k8s/overlays/prod/deployment-patch.yaml
# Change image: athena:v1.0.0 to image: your-registry.com/athena:v1.0.0
```

### 3. Deploy Using Kustomize
```bash
# Deploy all resources
kubectl apply -k k8s/overlays/prod/

# Wait for rollout
kubectl rollout status deployment/athena -n athena
```

### 4. Verify Deployment
```bash
# Check pods
kubectl get pods -n athena

# Check services
kubectl get svc -n athena

# Check ingress
kubectl get ingress -n athena

# View logs
kubectl logs -l app=athena -n athena --tail=100
```

## Post-Deployment Verification

### 1. Health Check
```bash
# Internal health check
kubectl exec -it deploy/athena -n athena -- curl http://localhost:3000/api/v1/health

# External health check (after DNS propagation)
curl https://api.athena.yourdomain.com/api/v1/health
```

### 2. Run Integration Tests
```bash
# Set environment variables
export BASE_URL=https://api.athena.yourdomain.com
export API_KEY=your-api-key

# Run load test
./scripts/run-load-test.sh
```

### 3. Verify WASM Modules
```bash
# Check WASM module loading
kubectl exec -it deploy/athena -n athena -- ls -la /app/wasm-modules/core/*/release/*.wasm

# Verify WASM status endpoint
curl https://api.athena.yourdomain.com/api/v1/status/wasm

# Expected response:
# {
#   "status": "healthy",
#   "modules": {
#     "analysis-engine": { "loaded": true, "version": "1.0.0" },
#     "crypto": { "loaded": true, "version": "1.0.0" },
#     "deobfuscator": { "loaded": true, "version": "1.0.0" },
#     "file-processor": { "loaded": true, "version": "1.0.0" },
#     "pattern-matcher": { "loaded": true, "version": "1.0.0" },
#     "network": { "loaded": true, "version": "1.0.0" },
#     "sandbox": { "loaded": true, "version": "1.0.0" }
#   }
# }
```

### 4. Test Redis Connection
```bash
# Check Redis connectivity
kubectl exec -it deploy/athena -n athena -- redis-cli -h athena-redis ping
```

## Monitoring Setup

### 1. Configure Prometheus Scraping
```yaml
# prometheus-config.yaml
- job_name: 'athena'
  kubernetes_sd_configs:
  - role: pod
    namespaces:
      names:
      - athena
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: true
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
    action: replace
    target_label: __metrics_path__
    regex: (.+)
  - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
    action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
    target_label: __address__
```

### 2. Import Grafana Dashboards
```bash
# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80

# Import dashboards from:
# - k8s/monitoring/grafana-dashboard-wasm.json
# - k8s/monitoring/grafana-dashboard-api.json
# - k8s/monitoring/grafana-dashboard-cache.json
```

### 3. Configure Alerts
```bash
# Apply Prometheus alerts
kubectl apply -f k8s/monitoring/prometheus-alerts.yaml -n monitoring
```

## Backup and Recovery

### 1. Redis Backup
```bash
# Create Redis backup
kubectl exec -it athena-redis-0 -n athena -- redis-cli BGSAVE

# Copy backup file
kubectl cp athena/athena-redis-0:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

### 2. Configuration Backup
```bash
# Backup all configurations
kubectl get all,cm,secret -n athena -o yaml > athena-backup-$(date +%Y%m%d).yaml
```

### 3. Automated Backup CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: athena-backup
  namespace: athena
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: redis:7-alpine
            command:
            - /bin/sh
            - -c
            - |
              redis-cli -h athena-redis BGSAVE
              sleep 10
              # Upload to S3 or other storage
          restartPolicy: OnFailure
```

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting
```bash
# Check pod events
kubectl describe pod <pod-name> -n athena

# Check resource constraints
kubectl top nodes
kubectl top pods -n athena
```

#### 2. WASM Module Errors
```bash
# Check WASM module integrity
kubectl exec -it deploy/athena -n athena -- md5sum /app/wasm-modules/core/*/release/*.wasm

# Verify module permissions
kubectl exec -it deploy/athena -n athena -- ls -la /app/wasm-modules/
```

#### 3. High Memory Usage
```bash
# Check memory usage
kubectl top pods -n athena

# Adjust resource limits if needed
kubectl edit deployment athena -n athena
```

#### 4. Redis Connection Issues
```bash
# Test Redis connection
kubectl exec -it deploy/athena -n athena -- nc -zv athena-redis 6379

# Check Redis logs
kubectl logs -l app=redis -n athena
```

### Performance Tuning

#### 1. HPA Tuning
```bash
# Monitor HPA status
kubectl get hpa -n athena -w

# Adjust HPA if needed
kubectl edit hpa athena-hpa -n athena
```

#### 2. Redis Optimization
```bash
# Connect to Redis
kubectl exec -it athena-redis-0 -n athena -- redis-cli

# Set performance parameters
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET maxmemory 4gb
```

#### 3. WASM Optimization
```bash
# Verify WASM optimization
kubectl exec -it deploy/athena -n athena -- ls -lah /app/wasm-modules/core/*/release/*.wasm

# Should show optimized sizes:
# - analysis-engine: ~310KB
# - crypto: ~250KB  
# - deobfuscator: ~1.3MB
# - file-processor: ~1.6MB
# - pattern-matcher: ~1.4MB
# - network: ~220KB
# - sandbox: ~650KB

# Check WASM performance metrics
kubectl exec -it deploy/athena -n athena -- curl http://localhost:3000/api/v1/metrics | grep wasm

# Key metrics to monitor:
# - wasm_module_load_time_ms
# - wasm_execution_time_ms
# - wasm_memory_usage_bytes
# - wasm_module_errors_total
```

## Maintenance

### Rolling Updates
```bash
# Update image
kubectl set image deployment/athena athena=your-registry.com/athena:v1.0.1 -n athena

# Monitor rollout
kubectl rollout status deployment/athena -n athena
```

### Scaling
```bash
# Manual scaling
kubectl scale deployment athena --replicas=10 -n athena

# Or let HPA handle it automatically
```

### Certificate Renewal
cert-manager handles automatic certificate renewal. Monitor certificate status:
```bash
kubectl get certificate -n athena
kubectl describe certificate athena-tls -n athena
```

## Security Checklist

- [ ] All secrets are properly configured and not using defaults
- [ ] Network policies are in place
- [ ] TLS is enabled and certificates are valid
- [ ] Pod security policies are configured
- [ ] RBAC is properly set up
- [ ] Images are scanned for vulnerabilities
- [ ] Resource limits are set on all containers
- [ ] Audit logging is enabled

## Support

For issues or questions:
1. Check logs: `kubectl logs -l app=athena -n athena`
2. Review metrics in Grafana
3. Check Prometheus alerts
4. Contact support team with:
   - Deployment ID: `kubectl get deploy athena -n athena -o jsonpath='{.metadata.uid}'`
   - Error logs
   - Steps to reproduce

---

**Last Updated**: 2025-06-14  
**Version**: 1.0.0