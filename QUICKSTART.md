# Athena Platform Quick Start Guide

## 🚀 Launching Athena

The Athena platform can be launched in multiple ways depending on your needs:

### Option 1: Interactive Menu (Recommended)
```bash
./scripts/athena
```
This opens an interactive menu with all available options:
- **Option 1**: Launch API Platform (opens launcher with multiple options)
- **Option 12**: Launch with Docker (includes monitoring)
- **Option 13**: Start local services
- **Option 14**: Run load tests
- **Option 15**: Run all tests
- **Option 16**: Run stress test (1000+ RPS)

**Note**: Options 4-7 are for the React Native/Expo frontend app (UI only)

### Option 2: Docker Compose (Full Platform)
```bash
./scripts/launch-athena.sh
```
Select option 1 for Docker Compose. This launches:
- API Server (port 3000)
- Redis Cache (port 6379)
- Prometheus Metrics (port 9091)
- Grafana Dashboards (port 3001)

### Option 3: Local Development
```bash
./scripts/start-all-services.sh
```
This starts:
- Redis (local or Docker)
- API Server (TypeScript/Node.js)
- Basic monitoring

### Option 4: Quick Docker Launch
```bash
docker-compose up -d
```
Starts all services in background.

## 📋 Prerequisites

### For Docker Compose:
- Docker Desktop installed and running
- 4GB RAM available
- Ports 3000, 6379, 9091, 3001 free

### For Local Development:
- Node.js 16+ installed
- npm or yarn
- Redis (optional - will use Docker if not found)

## 🔑 Configuration

1. **Create .env file** (if not exists):
```bash
cp .env.example .env
```

2. **Add your API keys**:
```env
CLAUDE_API_KEY=your_claude_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
OPENAI_API_KEY=your_openai_key_here
```

## 🌐 Service URLs

Once running, access services at:

| Service | URL | Description |
|---------|-----|-------------|
| API Server | http://localhost:3000 | Main API endpoint |
| Health Check | http://localhost:3000/api/v1/health | System health status |
| API Docs | http://localhost:3000/docs | Swagger documentation |
| Metrics | http://localhost:3000/metrics | Prometheus metrics |
| Prometheus | http://localhost:9091 | Metrics dashboard |
| Grafana | http://localhost:3001 | Visual dashboards (admin/admin) |

## 🧪 Testing the Platform

### 1. Health Check
```bash
curl http://localhost:3000/api/v1/health
```

### 2. Simple Load Test
```bash
./scripts/run-load-test.sh
```

### 3. Stress Test (1000+ RPS)
```bash
./scripts/run-stress-test.sh
```

### 4. WASM Module Test
```bash
curl -X POST http://localhost:3000/api/v1/wasm/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "module": "pattern-matcher",
    "data": "VGVzdCBkYXRh"
  }'
```

## 🛑 Stopping Services

### Docker Compose:
```bash
docker-compose down
```

### Local Services:
Press `Ctrl+C` in the terminal running the services.

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Docker Issues
```bash
# Reset Docker
docker-compose down -v
docker system prune -a
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping

# Start Redis manually
docker run -d -p 6379:6379 redis:7-alpine
```

### Build Errors
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

## 📊 Monitoring

### View Grafana Dashboards:
1. Navigate to http://localhost:3001
2. Login with admin/admin
3. Go to Dashboards → Athena

Available dashboards:
- WASM Performance
- API Performance
- Cache Performance
- AI Provider Metrics

### View Logs:
```bash
# Docker logs
docker-compose logs -f api

# Local logs
tail -f logs/athena.log
```

## 🚀 Production Deployment

For production deployment, see:
- [Production Deployment Guide](docs/deployment/production-deployment-guide.md)
- [Operations Manual](docs/deployment/operations-manual.md)

## 💡 Tips

1. **First Time Setup**: Use `./scripts/athena` and select option 3 (Update Everything)
2. **Development**: Use local services for faster iteration
3. **Testing**: Use Docker Compose for integration testing
4. **Production**: Use Kubernetes deployment (see docs)

## 🆘 Getting Help

- Check logs for detailed error messages
- Review [API Documentation](docs/api/openapi.yaml)
- Run health checks to diagnose issues
- Check service status in Docker/Kubernetes

---

**Ready to analyze malware at scale!** 🛡️