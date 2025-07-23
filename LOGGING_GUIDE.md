# Athena Log Aggregation Guide

## Overview

Athena uses the ELK Stack (Elasticsearch, Logstash, Kibana) for centralized log aggregation, analysis, and visualization. This provides:

- **Centralized Logging**: All logs from containers and applications in one place
- **Real-time Analysis**: Stream processing of logs with alerts
- **Visualization**: Pre-built dashboards for security and performance monitoring
- **Long-term Storage**: Indexed, searchable log archive

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│    Logstash     │────▶│  Elasticsearch  │
│   (Winston)     │     │  (Processing)   │     │   (Storage)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌─────────────────┐              ▼
│  Docker Logs    │────▶│    Filebeat     │     ┌─────────────────┐
│  (Containers)   │     │   (Shipper)     │     │     Kibana      │
└─────────────────┘     └─────────────────┘     │ (Visualization) │
                                                 └─────────────────┘
```

## Quick Start

### 1. Start the ELK Stack

```bash
# Start all logging components
./scripts/start-logging.sh

# Or manually with docker-compose
docker-compose -f docker-compose.logging.yml up -d
```

### 2. Configure Application Logging

Add to your `.env` file:
```env
LOGSTASH_HOST=localhost
LOGSTASH_PORT=5000
LOG_LEVEL=info
```

### 3. Access Kibana

Open http://localhost:5601 in your browser.

First time setup:
1. Go to Stack Management → Index Patterns
2. Create pattern: `athena-logs-*`
3. Select `@timestamp` as time field
4. Import dashboard from `monitoring/kibana/dashboards/`

## Components

### Elasticsearch
- **Port**: 9200
- **Purpose**: Log storage and search engine
- **Index Pattern**: `athena-logs-YYYY.MM.dd`
- **Retention**: 30 days (configurable)

### Logstash
- **Ports**: 
  - 5000 (TCP) - Application logs
  - 5044 (Beats) - Filebeat input
  - 12201 (GELF) - Docker logs
- **Pipeline**: `monitoring/logstash/pipeline/athena-logs.conf`
- **Features**:
  - JSON parsing
  - Security event detection
  - Performance metric extraction
  - Error tracking

### Kibana
- **Port**: 5601
- **Dashboards**:
  - System Overview
  - Security Events
  - API Performance
  - Error Analysis

### Filebeat
- **Purpose**: Ships container logs to Logstash
- **Configuration**: `monitoring/filebeat/filebeat.yml`
- **Features**:
  - Docker metadata enrichment
  - Multiline log handling
  - Automatic container discovery

## Log Format

### Application Logs (Winston)

```json
{
  "@timestamp": "2025-07-07T12:00:00.000Z",
  "level": "info",
  "message": "API request completed",
  "service": "athena-api",
  "environment": "production",
  "metadata": {
    "method": "POST",
    "path": "/api/v1/analyze",
    "statusCode": 200,
    "responseTime": 145,
    "userId": "user-12345"
  }
}
```

### Security Events

```json
{
  "@timestamp": "2025-07-07T12:00:00.000Z",
  "level": "warn",
  "message": "Security Event",
  "eventType": "auth_failed",
  "ip": "192.168.1.100",
  "userId": "unknown",
  "reason": "Invalid API key"
}
```

### Performance Metrics

```json
{
  "@timestamp": "2025-07-07T12:00:00.000Z",
  "level": "info",
  "message": "Performance Metric",
  "operation": "file_analysis",
  "duration": 2340,
  "fileSize": 1048576,
  "success": true
}
```

## Using the Logger

### Basic Logging

```javascript
const { logger } = require('./services/logger/winston-logger');

// Standard log levels
logger.info('Application started');
logger.warn('Low memory', { available: '100MB' });
logger.error('Database connection failed', { error: err });
logger.debug('Processing file', { filename: 'test.pdf' });
```

### Structured Logging

```javascript
// Log HTTP requests
logger.logRequest(req, res, responseTime);

// Log security events
logger.logSecurityEvent('suspicious_activity', {
  ip: req.ip,
  reason: 'Multiple failed attempts',
  attempts: 5
});

// Log performance metrics
logger.logPerformance('analysis_complete', 1234, {
  fileType: 'pdf',
  modules: ['static', 'dynamic']
});
```

## Kibana Queries

### Common Searches

```
# All errors
log_level:ERROR

# Security events
tags:security

# Slow API requests (>1000ms)
app.response_time:>1000

# Failed authentications
eventType:auth_failed

# Specific user activity
userId:"user-12345"

# API endpoint analysis
api_endpoint:analyze
```

### Advanced Queries

```
# Errors in last hour excluding health checks
log_level:ERROR AND NOT path:"/health" AND @timestamp:[now-1h TO now]

# High memory usage warnings
message:"memory" AND log_level:WARN

# Suspicious IPs with multiple failures
eventType:auth_failed AND _exists_:ip | stats count by ip
```

## Alerting

### Setting up Alerts in Kibana

1. Go to Stack Management → Watcher
2. Create new alert with conditions:
   ```json
   {
     "trigger": {
       "schedule": { "interval": "5m" }
     },
     "input": {
       "search": {
         "request": {
           "search_type": "query_then_fetch",
           "indices": ["athena-logs-*"],
           "body": {
             "query": {
               "bool": {
                 "must": [
                   { "term": { "log_level": "ERROR" } },
                   { "range": { "@timestamp": { "gte": "now-5m" } } }
                 ]
               }
             }
           }
         }
       }
     },
     "condition": {
       "compare": {
         "ctx.payload.hits.total": { "gt": 10 }
       }
     }
   }
   ```

## Best Practices

### 1. Structured Logging
- Use consistent field names
- Include contextual information
- Avoid logging sensitive data

### 2. Log Levels
- **ERROR**: System failures requiring attention
- **WARN**: Potential issues or security events
- **INFO**: Normal operations and metrics
- **DEBUG**: Detailed diagnostic information

### 3. Performance
- Use bulk operations for high-volume logs
- Set appropriate retention policies
- Monitor Elasticsearch disk usage

### 4. Security
- Don't log passwords or API keys
- Sanitize user input in logs
- Use field-level security in Kibana

## Troubleshooting

### Logs Not Appearing

1. Check connectivity:
   ```bash
   curl http://localhost:9200/_cluster/health
   curl http://localhost:5601/api/status
   ```

2. Verify Logstash pipeline:
   ```bash
   docker logs athena-logstash
   ```

3. Test log shipping:
   ```bash
   echo '{"level":"info","message":"test"}' | nc localhost 5000
   ```

### High Memory Usage

1. Adjust heap sizes in docker-compose:
   ```yaml
   environment:
     - "ES_JAVA_OPTS=-Xms256m -Xmx256m"
   ```

2. Implement index lifecycle management
3. Delete old indices:
   ```bash
   curl -X DELETE "localhost:9200/athena-logs-2025.01.*"
   ```

### Slow Queries

1. Check index health:
   ```bash
   curl http://localhost:9200/_cat/indices?v
   ```

2. Optimize mappings
3. Add more replicas for read-heavy workloads

## Maintenance

### Daily Tasks
- Monitor disk usage
- Check for error spikes
- Review security alerts

### Weekly Tasks
- Analyze performance trends
- Update dashboards
- Archive old logs

### Monthly Tasks
- Review retention policies
- Optimize index templates
- Update ELK stack versions

## Integration with Monitoring

The ELK stack integrates with Prometheus/Grafana:
- Elasticsearch metrics exported to Prometheus
- Grafana dashboards for log statistics
- Unified alerting through AlertManager