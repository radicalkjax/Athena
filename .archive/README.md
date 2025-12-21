# Archived Node.js Backend

**Date Archived:** November 2, 2025
**Reason:** Consolidated into Tauri-only architecture to eliminate duplication

## Contents

- `services_20251102/` - Full Node.js Express backend
  - AI Providers (Claude, OpenAI, DeepSeek) - TypeScript implementations
  - Agent system - Multi-agent orchestration
  - Redis cache - ioredis client
  - Prometheus metrics - prom-client
  - Database - PostgreSQL with Sequelize

- `package.json.bak` - Root package.json with Node.js dependencies

## Why Archived?

The Node.js backend was 100% duplicating functionality already in the Tauri Rust backend:
- Same AI providers implemented twice
- Redundant HTTP servers (Express vs Axum)
- Duplicated caching logic
- Unnecessary complexity

## If You Need to Restore

```bash
# Copy back to main directory
cp -r services_20251102 ../services
cp package.json.bak ../package.json

# Install dependencies
cd ..
npm install

# Start Node.js backend
npm run dev
```

## Can This Be Deleted?

**After 30 days** (December 2, 2025), if no issues are found with the Tauri-only architecture, this archive can be permanently deleted.

**Before deleting**, verify:
- [x] Tauri Redis client working
- [x] Tauri Prometheus metrics working
- [x] All AI providers functional
- [x] No regressions in malware analysis
- [x] Performance improvements validated

## Reference for Future Ports

If you need to port the agent system to Rust:
1. See `services_20251102/agents/` for TypeScript implementation
2. Key files:
   - `base/types.ts` - Agent type definitions
   - `base/agent.ts` - Base agent class
   - `base/message-bus.ts` - Inter-agent communication
   - `agent-manager.ts` - Agent lifecycle management

**Recommended Rust equivalent:**
- Use `tokio::sync::mpsc` for message passing
- Use `async-trait` for agent interface
- Use `serde` for message serialization

---

**Migration Guide:** See `/MIGRATION_TO_TAURI_ONLY.md`
