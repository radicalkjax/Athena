# Athena Scripts Directory

This directory contains all scripts for building, testing, deploying, and maintaining the Athena malware analysis platform.

> **Note:** The primary launcher script is now `./athena.sh` at the project root. See below for details.

## Main Entry Point

The primary way to run Athena is through the launcher script at the project root:

```bash
./athena.sh           # Start development mode (default)
./athena.sh build     # Build production application
./athena.sh test      # Run all tests
./athena.sh check     # Verify system requirements
```

## Directory Structure

```
scripts/
├── dev/                # Development scripts
├── build/              # Build and optimization scripts
├── test/               # Testing and validation scripts
├── deploy/             # Deployment scripts
├── maintenance/        # Backup, restore, and maintenance
├── security/           # Security-related scripts
└── utils/              # Utility scripts and one-off fixes
```

---

## Development Scripts (`dev/`)

Scripts for running services during development.

| Script | Description |
|--------|-------------|
| `start-all-services.sh` | Start all Athena services (API, backend, logging, UI) |
| `start-api.sh` | Start only the API server |
| `start-backend.sh` | Start only the backend services |
| `start-logging.sh` | Start logging infrastructure |
| `start-web-ui.sh` | Start web UI development server |

**Quick Start:**
```bash
# Use the main launcher (recommended)
./athena.sh

# Or start individual components
./scripts/dev/start-backend.sh
./scripts/dev/start-web-ui.sh
```

---

## Build Scripts (`build/`)

Scripts for building and optimizing the application.

| Script | Description |
|--------|-------------|
| `build-backend.sh` | Build Rust backend with optimizations |
| `optimize-wasm.sh` | Optimize WASM modules for production |
| `validate-build.sh` | Validate build artifacts and dependencies |

**Building for Production:**
```bash
# Build backend
./scripts/build/build-backend.sh

# Optimize WASM modules
./scripts/build/optimize-wasm.sh

# Validate everything
./scripts/build/validate-build.sh
```

---

## Test Scripts (`test/`)

Comprehensive testing and validation scripts.

| Script | Description |
|--------|-------------|
| `run-all-tests.js` | Run complete test suite |
| `test-comprehensive.js` | Comprehensive integration tests |
| `test-ci.sh` | CI/CD test pipeline |
| `test-wasm-analysis.js` | Test WASM analysis modules |
| `test-wasm-analysis.sh` | Shell-based WASM tests |
| `test-wasm.js` | WASM module tests |
| `test-simple-wasm.sh` | Simple WASM validation |
| `test-api-keys.js` | Validate API key configuration |
| `test-file-upload.sh` | Test file upload functionality |
| `run-benchmark.sh` | Performance benchmarks |
| `run-load-test.sh` | Load testing |
| `run-stress-test.sh` | Stress testing |
| `analyze-failures.js` | Analyze test failures |
| `analyze-test-failures.js` | Detailed test failure analysis |

**Running Tests:**
```bash
# Run all tests
./scripts/test/run-all-tests.js

# Run specific test suites
./scripts/test/test-comprehensive.js
./scripts/test/test-wasm-analysis.sh

# Performance testing
./scripts/test/run-benchmark.sh
./scripts/test/run-load-test.sh
./scripts/test/run-stress-test.sh

# Analyze failures
./scripts/test/analyze-failures.js
```

---

## Deployment Scripts (`deploy/`)

Scripts for production deployment and validation.

| Script | Description |
|--------|-------------|
| `deploy-production.sh` | Deploy to production environment |
| `validate-production.sh` | Validate production deployment |
| `quick-production-test.sh` | Quick smoke tests for production |

**Deploying to Production:**
```bash
# Deploy
./scripts/deploy/deploy-production.sh

# Validate deployment
./scripts/deploy/validate-production.sh

# Quick smoke test
./scripts/deploy/quick-production-test.sh
```

---

## Maintenance Scripts (`maintenance/`)

System maintenance, backup, and restore operations.

| Script | Description |
|--------|-------------|
| `backup-system.sh` | Backup Athena system and data |
| `restore-system.sh` | Restore from backup |
| `setup-cron-backup.sh` | Configure automated backups |

**Backup and Restore:**
```bash
# Create backup
./scripts/maintenance/backup-system.sh

# Restore from backup
./scripts/maintenance/restore-system.sh

# Setup automated backups
./scripts/maintenance/setup-cron-backup.sh
```

---

## Security Scripts (`security/`)

Security auditing, API key management, and SSL certificate generation.

| Script | Description |
|--------|-------------|
| `check-api-keys.js` | Verify API key configuration |
| `manage-api-keys.js` | Manage API keys (add, remove, rotate) |
| `security-tests.js` | Security vulnerability tests |
| `generate-ssl-cert.sh` | Generate SSL certificates |

**Security Operations:**
```bash
# Check API keys
./scripts/security/check-api-keys.js

# Manage API keys
./scripts/security/manage-api-keys.js

# Run security tests
./scripts/security/security-tests.js

# Generate SSL certificate
./scripts/security/generate-ssl-cert.sh
```

---

## Utility Scripts (`utils/`)

One-off utilities, migration scripts, and fix scripts.

| Script | Description |
|--------|-------------|
| `fix-duplicate-imports.js` | Fix duplicate import statements |
| `fix-error-handling.sh` | Fix error handling patterns |
| `fix-remaining-ts-errors.sh` | Fix remaining TypeScript errors |
| `fix-unknown-errors.sh` | Fix unknown type errors |
| `fix-web-build.sh` | Fix web build issues |
| `fix-window-references.sh` | Fix window reference issues |
| `migrate-jest-to-vitest.js` | Migrate from Jest to Vitest |
| `performance-benchmark.js` | Performance benchmarking utility |

**Note:** Most `fix-*.sh` scripts are one-time fixes that may have already been applied. Review before running.

---

## Common Workflows

### Development Setup
```bash
# Start all services
./scripts/dev/start-all-services.sh
```

### Pre-Commit Testing
```bash
# Run all tests
./scripts/test/run-all-tests.js

# Validate build
./scripts/build/validate-build.sh
```

### Production Deployment
```bash
# Build
./scripts/build/build-backend.sh
./scripts/build/optimize-wasm.sh

# Deploy
./scripts/deploy/deploy-production.sh

# Validate
./scripts/deploy/validate-production.sh
```

### Regular Maintenance
```bash
# Backup system
./scripts/maintenance/backup-system.sh

# Run security checks
./scripts/security/security-tests.js
```

---

## Best Practices

1. **Always test before deploying**: Run `./scripts/test/run-all-tests.js` before production deployment
2. **Backup before major changes**: Use `./scripts/maintenance/backup-system.sh`
3. **Validate builds**: Run `./scripts/build/validate-build.sh` after building
4. **Check security regularly**: Run `./scripts/security/security-tests.js` periodically
5. **Review logs**: Check output from scripts for warnings and errors

## Troubleshooting

If a script fails:

1. Check script permissions: `chmod +x scripts/path/to/script.sh`
2. Review script output for error messages
3. Ensure all dependencies are installed
4. Check environment variables and API keys
5. Consult individual script documentation (use `--help` flag if available)

## Contributing

When adding new scripts:

1. Place them in the appropriate subdirectory
2. Follow existing naming conventions
3. Add execute permissions: `chmod +x script.sh`
4. Document the script in this README
5. Include usage examples and error handling

---

**Last Updated:** December 21, 2025
**Athena Version:** v2.0
**Branch:** tauri-migration
