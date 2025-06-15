# 🚀 Athena Platform - Start Here!

## What do you want to launch?

### 🛡️ **Full Malware Analysis Platform** (Recommended)
This is the complete backend system with API, WASM modules, and monitoring.

**Quick Start:**
```bash
./scripts/athena
# Then choose Option 1: Start Athena API Platform
```

Or directly:
```bash
# With Docker (includes monitoring):
./scripts/launch-athena.sh
# Choose option 1 for Docker Compose

# Without Docker:
./scripts/start-all-services.sh
```

**What you get:**
- ✅ API Server (port 3000)
- ✅ WASM malware analysis modules
- ✅ Redis caching
- ✅ Prometheus metrics
- ✅ Grafana dashboards
- ✅ Full analysis capabilities

### 📱 **React Native UI Only**
This is just the frontend interface without backend services.

```bash
./scripts/athena
# Then choose Option 4: Start React Native Web
```

**Note:** This UI needs the backend API to function properly!

## 🎯 Recommended Setup

1. **First Time Setup:**
   ```bash
   ./scripts/athena
   # Choose Option 3: Update Everything
   ```

2. **Launch Full Platform:**
   ```bash
   ./scripts/athena
   # Choose Option 1: Start Athena API Platform
   # Then select "Docker Compose" for easiest setup
   ```

3. **Verify Everything Works:**
   ```bash
   # Check API health
   curl http://localhost:3000/api/v1/health
   
   # View metrics
   open http://localhost:9091  # Prometheus
   open http://localhost:3001  # Grafana (admin/admin)
   ```

## 🔧 Troubleshooting

### "Index of dist" Error
This happens when trying to run the React Native web UI. Solutions:
1. Use the backend API instead (Option 1)
2. Or run Expo dev server: `cd Athena && npm run web`

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Docker Not Running
- Start Docker Desktop
- Or use local services: Option 13

## 📚 Documentation

- [Quick Start Guide](QUICKSTART.md)
- [API Documentation](docs/api/openapi.yaml)
- [Production Deployment](docs/deployment/production-deployment-guide.md)
- [Phase 5 Summary](docs/phase5-completion-summary.md)

---

**Remember:** The Athena platform is primarily a backend malware analysis system. The React Native UI is optional and requires the backend to be running!