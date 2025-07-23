# Athena Backend Setup Guide

This guide explains how to run the Athena backend services using Docker.

## Prerequisites

- Docker Desktop installed and running
- At least one AI provider API key (Claude, DeepSeek, or OpenAI)

## Quick Start (Recommended)

The easiest way to start the backend:

```bash
./start-backend.sh
```

This script will:
- Check Docker is running
- Create a `.env` file if needed
- Start all backend services
- Show you the service URLs

## Manual Setup

### 1. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# AI Provider Keys (add at least one)
CLAUDE_API_KEY=your-claude-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
OPENAI_API_KEY=your-openai-api-key

# Redis Configuration (optional)
REDIS_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 2. Choose Your Docker Setup

We provide three Docker configurations:

#### Option A: Development Mode (Simplest)
```bash
docker-compose -f docker-compose.dev.yml up -d
```
- No WASM compilation required
- Mounts source code directly
- Best for development

#### Option B: Simple Production Mode
```bash
docker-compose -f docker-compose.simple.yml up -d
```
- Uses simplified Dockerfile
- WASM modules disabled
- Good for testing the API

#### Option C: Full Production Mode (Advanced)
```bash
# First build WASM modules
./build-backend.sh

# Then start services
docker-compose up -d
```
- Requires Rust and wasm-pack installed
- Full WASM functionality
- Best performance

## Service URLs

Once running, services are available at:

- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/v1/health
- **API Docs**: http://localhost:3000/api-docs
- **Metrics**: http://localhost:9090/metrics
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)

## Testing the API

### Health Check
```bash
curl http://localhost:3000/api/v1/health
```

### List AI Providers
```bash
curl http://localhost:3000/api/v1/providers
```

### Analyze Content
```bash
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test content for analysis",
    "providerId": "claude",
    "options": {
      "temperature": 0.7
    }
  }'
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs -f

# Restart services
docker-compose restart

# Clean start
docker-compose down -v
docker-compose up -d
```

### API returns errors
- Check you have at least one API key in `.env`
- Verify Redis is running: `docker-compose ps`
- Check API logs: `docker-compose logs api`

### Port conflicts
If ports are already in use, modify the port mappings in docker-compose.yml:
```yaml
ports:
  - "3001:3000"  # Change 3001 to another port
```

## Development Tips

### Watch logs in real-time
```bash
docker-compose logs -f api
```

### Restart after code changes
```bash
docker-compose restart api
```

### Access Redis CLI
```bash
docker-compose exec redis redis-cli
```

### View metrics in Prometheus
1. Open http://localhost:9091
2. Try queries like:
   - `http_request_duration_seconds`
   - `ai_analysis_duration_seconds`
   - `cache_hit_ratio`

## Next Steps

1. Frontend Integration:
   - Update frontend to use `http://localhost:3000` as API base URL
   - Configure CORS if needed

2. WASM Integration (Optional):
   - Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
   - Install wasm-pack: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
   - Build WASM modules: `./build-backend.sh`

3. Production Deployment:
   - Use Kubernetes configs in `/k8s` directory
   - Set up proper secrets management
   - Configure monitoring and alerting