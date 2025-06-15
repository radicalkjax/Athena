# Athena Operations Manual

## Daily Operations

### Morning Health Checks (9:00 AM)

1. **System Status Dashboard**
   ```bash
   # Quick health check
   curl https://api.athena.yourdomain.com/api/v1/health
   
   # Check pod status
   kubectl get pods -n athena
   
   # Check HPA status
   kubectl get hpa -n athena
   ```

2. **Review Overnight Alerts**
   - Check Prometheus alerts
   - Review any PagerDuty incidents
   - Check error logs from past 12 hours

3. **Performance Metrics**
   - Open Grafana dashboards
   - Check response time trends
   - Verify cache hit rates
   - Review WASM module performance

### Routine Maintenance Tasks

#### Weekly Tasks

1. **Security Updates** (Mondays)
   ```bash
   # Check for image updates
   docker pull your-registry.com/athena:latest
   
   # Scan for vulnerabilities
   trivy image your-registry.com/athena:v1.0.0
   ```

2. **Backup Verification** (Wednesdays)
   ```bash
   # Test Redis backup
   kubectl exec -it athena-redis-0 -n athena -- redis-cli BGSAVE
   
   # Verify backup file
   kubectl exec -it athena-redis-0 -n athena -- ls -la /data/dump.rdb
   ```

3. **Performance Review** (Fridays)
   - Review week's performance metrics
   - Check for any degradation trends
   - Plan optimization if needed

#### Monthly Tasks

1. **Certificate Check**
   ```bash
   kubectl get certificates -n athena
   # Ensure all certificates have >30 days validity
   ```

2. **Capacity Planning**
   - Review resource utilization trends
   - Forecast next month's needs
   - Plan scaling if necessary

3. **Disaster Recovery Test**
   - Perform failover test
   - Verify backup restoration
   - Update runbooks if needed

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 | Service Down | 15 minutes | API unavailable, all pods crashing |
| P2 | Major Degradation | 1 hour | High error rate, slow responses |
| P3 | Minor Issue | 4 hours | Single pod issues, cache misses |
| P4 | Low Priority | Next business day | Documentation, minor bugs |

### P1 Incident Response Playbook

1. **Immediate Actions** (0-5 minutes)
   ```bash
   # Check service status
   kubectl get pods -n athena
   kubectl get svc -n athena
   
   # Check recent events
   kubectl get events -n athena --sort-by='.lastTimestamp'
   
   # View logs
   kubectl logs -l app=athena -n athena --tail=100
   ```

2. **Diagnosis** (5-10 minutes)
   - Check Grafana for anomalies
   - Review error logs
   - Check external dependencies (Redis, AI providers)
   
3. **Mitigation** (10-15 minutes)
   
   **Option A: Rolling Restart**
   ```bash
   kubectl rollout restart deployment/athena -n athena
   ```
   
   **Option B: Scale Up**
   ```bash
   kubectl scale deployment athena --replicas=10 -n athena
   ```
   
   **Option C: Rollback**
   ```bash
   kubectl rollout undo deployment/athena -n athena
   ```

4. **Communication**
   - Update status page
   - Notify stakeholders
   - Create incident ticket

### Common Issues and Solutions

#### High Error Rate
```bash
# Check AI provider status
curl -X GET https://api.anthropic.com/v1/health
curl -X GET https://api.openai.com/v1/health

# Check circuit breaker status
kubectl exec -it deploy/athena -n athena -- curl http://localhost:3000/internal/circuit-breakers

# Temporary mitigation: Increase timeout
kubectl set env deployment/athena AI_PROVIDER_TIMEOUT=60000 -n athena
```

#### Memory Issues
```bash
# Check memory usage
kubectl top pods -n athena

# Find memory leaks
kubectl exec -it deploy/athena -n athena -- node --inspect=0.0.0.0:9229

# Increase memory limit temporarily
kubectl patch deployment athena -n athena -p '{"spec":{"template":{"spec":{"containers":[{"name":"athena","resources":{"limits":{"memory":"8Gi"}}}]}}}}'
```

#### Redis Issues
```bash
# Check Redis status
kubectl exec -it athena-redis-0 -n athena -- redis-cli ping

# Check Redis memory
kubectl exec -it athena-redis-0 -n athena -- redis-cli info memory

# Flush cache if needed (WARNING: This will clear all cache)
kubectl exec -it athena-redis-0 -n athena -- redis-cli FLUSHALL
```

## Performance Optimization

### Query Optimization
1. **Monitor Slow Queries**
   ```bash
   # Check API response times
   kubectl logs -l app=athena -n athena | grep "response_time" | awk '{if ($NF > 1000) print}'
   ```

2. **Cache Optimization**
   ```bash
   # Check cache hit rate
   kubectl exec -it athena-redis-0 -n athena -- redis-cli info stats | grep hits
   
   # Adjust TTL if needed
   kubectl set env deployment/athena CACHE_DEFAULT_TTL=600 -n athena
   ```

3. **WASM Module Optimization**
   - Monitor module load times
   - Ensure modules are properly cached
   - Verify optimization flags are enabled

### Scaling Strategies

#### Vertical Scaling
```bash
# Increase resources
kubectl patch deployment athena -n athena -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "athena",
          "resources": {
            "requests": {"cpu": "2", "memory": "4Gi"},
            "limits": {"cpu": "4", "memory": "8Gi"}
          }
        }]
      }
    }
  }
}'
```

#### Horizontal Scaling
```bash
# Adjust HPA
kubectl patch hpa athena-hpa -n athena -p '{
  "spec": {
    "minReplicas": 5,
    "maxReplicas": 20,
    "targetCPUUtilizationPercentage": 60
  }
}'
```

## Monitoring and Alerting

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|------------------|-------------------|---------|
| API Response Time (p95) | >300ms | >500ms | Scale up, check DB |
| Error Rate | >1% | >5% | Check logs, dependencies |
| CPU Usage | >70% | >85% | Scale horizontally |
| Memory Usage | >75% | >90% | Scale vertically |
| Cache Hit Rate | <60% | <40% | Review cache strategy |
| WASM Load Time | >50ms | >100ms | Check module optimization |

### Custom Alerts

```yaml
# Example: Slow WASM Module Alert
- alert: SlowWASMModuleLoad
  expr: histogram_quantile(0.95, wasm_module_load_duration_bucket) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "WASM module loading slowly"
    description: "95th percentile load time is {{ $value }}s"
```

## Backup and Recovery Procedures

### Automated Backups
- Redis: Every 2 hours
- Configuration: Daily at 2 AM
- Logs: Retained for 30 days

### Manual Backup
```bash
# Full system backup
./scripts/backup-athena.sh

# Redis only
kubectl exec -it athena-redis-0 -n athena -- redis-cli BGSAVE
kubectl cp athena/athena-redis-0:/data/dump.rdb ./backups/redis-$(date +%Y%m%d-%H%M%S).rdb
```

### Recovery Procedures

#### Redis Recovery
```bash
# Stop Redis
kubectl scale statefulset athena-redis --replicas=0 -n athena

# Restore backup
kubectl cp ./backups/redis-20250614.rdb athena/athena-redis-0:/data/dump.rdb

# Start Redis
kubectl scale statefulset athena-redis --replicas=1 -n athena
```

#### Full System Recovery
```bash
# Apply backed up configuration
kubectl apply -f ./backups/athena-backup-20250614.yaml

# Restore Redis data
# Follow Redis recovery procedure above

# Verify system health
curl https://api.athena.yourdomain.com/api/v1/health
```

## Security Operations

### Daily Security Tasks
1. Review authentication logs
2. Check for failed login attempts
3. Monitor API key usage
4. Review firewall logs

### API Key Management
```bash
# Rotate API keys quarterly
# Generate new key
openssl rand -base64 32

# Update in Kubernetes secret
kubectl edit secret athena-api-keys -n athena
```

### Security Scanning
```bash
# Weekly vulnerability scan
trivy image your-registry.com/athena:v1.0.0

# Network policy verification
kubectl describe networkpolicy -n athena
```

## Compliance and Auditing

### Audit Log Collection
```bash
# Export audit logs
kubectl logs -l app=athena -n athena --since=24h > audit-$(date +%Y%m%d).log

# Search for specific activities
grep "ANALYSIS_STARTED\|ANALYSIS_COMPLETED" audit-*.log
```

### Compliance Checks
- [ ] Weekly: Review access logs
- [ ] Monthly: Generate usage reports
- [ ] Quarterly: Security audit
- [ ] Annually: Penetration testing

## Communication Protocols

### Status Page Updates
- P1: Update within 5 minutes
- P2: Update within 30 minutes
- P3: Update within 2 hours

### Stakeholder Communication
- Engineering: Slack #athena-ops
- Management: Email updates
- Customers: Status page + email for P1/P2

## Runbooks

### Runbook: High Memory Usage
1. Identify memory-consuming pods
2. Check for memory leaks
3. Review recent deployments
4. Scale vertically if needed
5. Implement memory limits

### Runbook: API Timeout Issues
1. Check upstream dependencies
2. Review slow query logs
3. Check network latency
4. Increase timeouts temporarily
5. Optimize slow endpoints

### Runbook: Certificate Expiry
1. Check certificate status
2. Verify cert-manager is running
3. Manually renew if needed
4. Update DNS if required
5. Test TLS connectivity

---

**Last Updated**: 2025-06-14  
**Version**: 1.0.0