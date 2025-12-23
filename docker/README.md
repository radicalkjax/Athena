# Athena Docker Configuration

This directory contains all Docker-related configuration files for the Athena v2 malware analysis platform.

## Directory Structure

```
docker/
├── docker-compose.yml           # Main/default compose file (full stack)
├── docker-compose.dev.yml       # Development overrides (simplified)
├── docker-compose.prod.yml      # Production deployment (SSL, resource limits)
├── docker-compose.logging.yml   # ELK stack for centralized logging
├── Dockerfile                   # Main application image
├── Dockerfile.simple            # Lightweight variant (WASM disabled)
├── Dockerfile.prometheus        # Custom Prometheus with configs
├── prometheus.yml               # Prometheus scrape configuration
└── README.md                    # This file
```

## Docker Compose Files

### docker-compose.yml (Default/Full Stack)

**Purpose:** Complete development stack with all monitoring tools

**Services:**
- `redis` - Redis cache (port 6379)
- `api` - Main API server (ports 3000, 9090)
- `prometheus` - Metrics collection (port 9091)
- `grafana` - Metrics visualization (port 3001)

**Usage:**
```bash
# From project root
cd /Users/kali/Athena/Athena
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop all services
docker compose -f docker/docker-compose.yml down
```

**Environment Variables Required:**
- `REDIS_PASSWORD` - Redis authentication password
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `OPENAI_API_KEY` - OpenAI API key

**Ports Exposed:**
- 3000 - API Server
- 3001 - Grafana Dashboard
- 6379 - Redis Cache
- 9090 - API Metrics
- 9091 - Prometheus UI

---

### docker-compose.dev.yml (Development)

**Purpose:** Simplified development setup without full WASM stack

**Services:**
- `redis` - Redis cache (512MB limit)
- `api` - API server with live code mounting
- `prometheus` - Basic metrics monitoring

**Usage:**
```bash
# From project root
docker compose -f docker/docker-compose.dev.yml up -d

# With code hot-reload
docker compose -f docker/docker-compose.dev.yml up --build
```

**Environment Variables Required:**
All from docker-compose.yml plus:
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRY` - Token expiration time
- `ADMIN_API_KEY` - Admin access key
- `CLIENT_API_KEY` - Client access key
- `ANALYSIS_API_KEY` - Analysis endpoint key
- `CORS_ORIGIN` - CORS allowed origins
- `ENABLE_RATE_LIMITING` - Enable/disable rate limiting
- `SECURITY_AUDIT_LOG` - Security audit log path

**Features:**
- Volume mounts for live code updates
- Lower resource limits for development
- WASM modules can be toggled with `DISABLE_WASM` env var

---

### docker-compose.prod.yml (Production)

**Purpose:** Production-ready deployment with SSL, PostgreSQL, resource limits, and monitoring

**Services:**
- `api` - Production API with SSL (ports 80, 443, 9090)
- `db` - PostgreSQL database (internal only)
- `redis` - Redis with password authentication
- `prometheus` - Metrics with 30-day retention
- `grafana` - Dashboard with provisioned datasources
- `nginx` - Reverse proxy (port 8080)

**Usage:**
```bash
# From project root
docker compose -f docker/docker-compose.prod.yml up -d

# View production logs
docker compose -f docker/docker-compose.prod.yml logs -f api

# Restart a specific service
docker compose -f docker/docker-compose.prod.yml restart api
```

**Environment File Required:**
Create `.env.production` in the project root with:
```env
NODE_ENV=production
POSTGRES_PASSWORD=secure_production_password_change_me
REDIS_PASSWORD=secure_redis_password_change_me
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
```

**IMPORTANT SECURITY NOTES:**
1. **Change default passwords** in docker-compose.prod.yml:
   - PostgreSQL password (line 55)
   - Redis password (line 81)
   - Grafana admin password (line 136)

2. **Mount SSL certificates** before starting:
   - Place certificates in `/etc/ssl/certs`
   - Place private keys in `/etc/ssl/private`

3. **Configure nginx** before deployment:
   - Create `../nginx/nginx.conf`
   - Place SSL certs in `../nginx/ssl`

**Resource Limits:**
- API: 2 CPU, 4GB RAM (reserved: 1 CPU, 2GB)
- Database: 1 CPU, 2GB RAM (reserved: 0.5 CPU, 1GB)
- Redis: 0.5 CPU, 1GB RAM (reserved: 0.25 CPU, 512MB)
- Prometheus: 0.5 CPU, 1GB RAM
- Grafana: 0.5 CPU, 1GB RAM
- Nginx: 0.25 CPU, 256MB RAM

**Persistent Volumes:**
- `athena_db_data` - PostgreSQL database
- `athena_redis_data` - Redis persistence
- `athena_prometheus_data` - Metrics data (30 days)
- `athena_grafana_data` - Grafana dashboards
- `athena_uploads` - User-uploaded files
- `athena_temp` - Temporary analysis files
- `athena_logs` - Application and nginx logs

---

### docker-compose.logging.yml (ELK Stack)

**Purpose:** Centralized logging with Elasticsearch, Logstash, Kibana, and Filebeat

**Services:**
- `elasticsearch` - Log storage and search (port 9200)
- `logstash` - Log processing pipeline (ports 5044, 5000, 12201)
- `kibana` - Log visualization (port 5601)
- `filebeat` - Container log shipper

**Usage:**
```bash
# Start ELK stack
docker compose -f docker/docker-compose.logging.yml up -d

# Access Kibana UI
open http://localhost:5601

# View Elasticsearch health
curl http://localhost:9200/_cluster/health
```

**Prerequisites:**
Create logging configuration files:
- `../monitoring/logstash/pipeline/` - Logstash pipelines
- `../monitoring/logstash/config/logstash.yml` - Logstash config
- `../monitoring/filebeat/filebeat.yml` - Filebeat config

**Ports Exposed:**
- 5601 - Kibana UI
- 9200 - Elasticsearch REST API
- 5044 - Beats input (Filebeat)
- 5000 - TCP input (application logs)
- 12201 - GELF input (Docker logs)

**Resource Requirements:**
- Elasticsearch: 512MB heap (configurable)
- Logstash: 256MB heap (configurable)
- Recommended host: 4GB+ RAM

---

## Dockerfiles

### Dockerfile (Main Application)

Full-featured Node.js + WASM build with:
- Multi-stage build for optimization
- WASM module compilation
- Production and development targets
- Health checks and security hardening

**Build manually:**
```bash
docker build -f docker/Dockerfile -t athena-api:latest ..
```

---

### Dockerfile.simple (Lightweight)

Minimal Node.js build without WASM:
- Single-stage build
- No WASM dependencies
- Faster build times
- Suitable for testing API-only features

**Build manually:**
```bash
docker build -f docker/Dockerfile.simple -t athena-api:simple ..
```

---

### Dockerfile.prometheus (Custom Prometheus)

Custom Prometheus image with pre-configured settings:
- Embedded prometheus.yml configuration
- Optimized for Athena metrics

**Build manually:**
```bash
docker build -f docker/Dockerfile.prometheus -t athena-prometheus:latest .
```

---

## Common Operations

### Start Full Development Stack
```bash
cd /Users/kali/Athena/Athena
docker compose -f docker/docker-compose.yml up -d
```

### Start Production Stack
```bash
# 1. Configure environment
cp .env.example .env.production
vim .env.production  # Edit with production values

# 2. Update passwords in docker-compose.prod.yml
vim docker/docker-compose.prod.yml

# 3. Start services
docker compose -f docker/docker-compose.prod.yml up -d
```

### Add Centralized Logging
```bash
# Run alongside other compose files
docker compose -f docker/docker-compose.logging.yml up -d
```

### Rebuild After Code Changes
```bash
# Development
docker compose -f docker/docker-compose.dev.yml up --build -d

# Production
docker compose -f docker/docker-compose.prod.yml build api
docker compose -f docker/docker-compose.prod.yml up -d api
```

### View Logs
```bash
# All services
docker compose -f docker/docker-compose.yml logs -f

# Specific service
docker compose -f docker/docker-compose.yml logs -f api

# Last 100 lines
docker compose -f docker/docker-compose.yml logs --tail=100 api
```

### Clean Up
```bash
# Stop and remove containers
docker compose -f docker/docker-compose.yml down

# Also remove volumes (WARNING: deletes data)
docker compose -f docker/docker-compose.yml down -v

# Remove unused images
docker image prune -a
```

---

## Network Architecture

All compose files create isolated bridge networks:

- `athena-network` (main/dev/prod) - Application network
- `athena-logging` (logging) - ELK stack network

To connect services across stacks, use Docker's external network feature.

---

## Health Checks

All services include health checks:

- **Redis:** `redis-cli ping`
- **API:** `curl http://localhost:3000/api/v1/health`
- **PostgreSQL:** `pg_isready`
- **Elasticsearch:** `curl /_cluster/health`
- **Kibana:** `curl /api/status`

View health status:
```bash
docker compose -f docker/docker-compose.yml ps
```

---

## Troubleshooting

### Service won't start
```bash
# Check logs
docker compose -f docker/docker-compose.yml logs service-name

# Check resource usage
docker stats
```

### Port already in use
```bash
# Find process using port
lsof -i :3000

# Or change port in compose file
```

### Volume permission issues
```bash
# Fix volume ownership (development only)
docker compose -f docker/docker-compose.yml down
sudo chown -R $USER:$USER ./volumes
docker compose -f docker/docker-compose.yml up -d
```

### Out of disk space
```bash
# Clean up unused resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

---

## Integration with Tauri Desktop App

The Docker services are **optional** for the Tauri desktop application (athena-v2). They provide:

1. **Redis caching** - Faster AI response caching
2. **Metrics collection** - Performance monitoring
3. **Log aggregation** - Centralized debugging

The Tauri app runs standalone and only connects to Docker services if available.

**Check Docker integration:**
```bash
# From athena-v2 directory
npm run tauri:dev

# Check if Redis is detected in app logs
# If not connected, app will use in-memory cache instead
```

## WASM Modules (December 2025)

All 9 WASM modules are built using the Component Model and loaded via Wasmtime 29.0:

- **analysis-engine** - CFG, decompiler, emulator
- **crypto** - AES/DES detection, hash functions
- **deobfuscator** - Control flow flattening detection
- **disassembler** - x86/x64/ARM disassembly
- **file-processor** - PE/ELF/Mach-O parsing
- **network** - DNS/HTTP/TLS/HTTP2 analysis
- **pattern-matcher** - YARA-x integration
- **sandbox** - Syscall tracking, behavioral analysis
- **security** - Security validation

**Build WASM modules:**
```bash
cd athena-v2/wasm-modules/core/<module-name>
cargo component build --release
```

**Status**: All modules 100% complete as of December 2025.

---

## Environment Variables Reference

### Core API Configuration
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - API server port (default: 3000)
- `METRICS_PORT` - Prometheus metrics port (default: 9090)

### Redis Configuration
- `REDIS_HOST` - Redis hostname (default: redis)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis authentication password

### AI Provider Keys
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `OPENAI_API_KEY` - OpenAI API key

### WASM Configuration
- `DISABLE_WASM` - Disable WASM modules (true/false)
- `WASM_MEMORY_LIMIT` - Memory limit in MB (default: 512)
- `WASM_ENABLE_BULK_MEMORY` - Enable bulk memory operations

### Security (Production)
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRY` - Token expiration time
- `ADMIN_API_KEY` - Admin access key
- `CLIENT_API_KEY` - Client access key
- `ANALYSIS_API_KEY` - Analysis endpoint key
- `CORS_ORIGIN` - CORS allowed origins
- `ENABLE_RATE_LIMITING` - Enable rate limiting
- `SECURITY_AUDIT_LOG` - Security audit log path

### Monitoring
- `METRICS_ENABLED` - Enable Prometheus metrics (true/false)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [Grafana Documentation](https://grafana.com/docs/)
- [ELK Stack Guide](https://www.elastic.co/what-is/elk-stack)

For Athena-specific documentation, see:
- `/Users/kali/Athena/Athena/README.md`
- `/Users/kali/Athena/Athena/agentdocs/CLAUDE.md`
- `/Users/kali/Athena/Athena/CLAUDE.md`
