# API Key Database Migration Guide

## Overview

This guide covers the migration from file-based API keys (environment variables) to PostgreSQL database storage. The migration is designed to be backward compatible, allowing gradual transition without service disruption.

## Migration Status

✅ **Database Schema**: Ready (created in `database/init/02-security-tables.sql`)  
✅ **Database Connection**: Implemented (`services/database/connection.js`)  
✅ **API Key Repository**: Implemented (`services/database/apiKeyRepository.js`)  
✅ **Authentication Middleware**: Updated with fallback support  
✅ **Management CLI**: Created (`scripts/manage-api-keys.js`)  

## Benefits of Database Storage

1. **Dynamic Management**: Create, revoke, and manage keys without restarting services
2. **Enhanced Security**: Keys are hashed (SHA-256) before storage
3. **Granular Permissions**: JSONB storage allows flexible permission models
4. **Usage Tracking**: Track last used time and usage count
5. **Rate Limiting**: Per-key rate limits configurable in database
6. **Audit Trail**: All key operations logged in `security_events` table

## How the Migration Works

### Backward Compatibility

The system maintains full backward compatibility:

1. **Database First**: If PostgreSQL is available, API keys are validated against the database
2. **Fallback to Environment**: If database is unavailable or key not found, falls back to environment variables
3. **Legacy Keys Work**: Existing `ADMIN_API_KEY`, `CLIENT_API_KEY`, and `ANALYSIS_API_KEY` continue to work
4. **No Service Disruption**: Services can continue running during migration

### Permission Model

The new permission model is more granular:

**Legacy Format** (environment variables):
```javascript
// Simple array of permissions
['analyze', 'workflow', 'admin', 'upload', 'wasm']
```

**New Format** (database):
```javascript
// Resource:action format
['admin:*', 'analysis:*', 'system:*']
['analysis:read', 'workflow:execute']
```

The system automatically maps between formats for compatibility.

## Migration Steps

### 1. Configure Database Connection

Add to your `.env` file:
```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=athena_db
DB_USER=athena_admin
DB_PASSWORD=your_secure_password
```

### 2. Ensure Database is Running

With Docker Compose:
```bash
docker-compose -f docker-compose.production.yml up postgres -d
```

Or verify existing PostgreSQL:
```bash
psql -h localhost -U athena_admin -d athena_db -c "SELECT NOW();"
```

### 3. Create New API Keys

Use the management CLI to create database-stored keys:

```bash
# Create an admin key
node scripts/manage-api-keys.js create admin --description "Production admin key"

# Create an analysis key with 30-day expiration
node scripts/manage-api-keys.js create analysis --expires 30

# Create a client key with custom permissions
node scripts/manage-api-keys.js create client --permissions "analysis:read" "workflow:execute"
```

### 4. Test New Keys

Validate the new keys work correctly:
```bash
# Validate a key
node scripts/manage-api-keys.js validate <your-new-api-key>

# Test with curl
curl -H "X-API-Key: <your-new-api-key>" http://localhost:3000/api/v1/health
```

### 5. Update Application Configuration

Replace environment variable keys with database keys in your applications:

**Before** (`.env`):
```env
ADMIN_API_KEY=old-static-key
```

**After** (application code):
```javascript
// Keys are now managed in database
// Use the manage-api-keys.js CLI to create/manage keys
```

### 6. Monitor the Transition

Check logs for authentication methods:
```bash
# Shows whether keys are validated via database or fallback
docker logs athena-api-dev | grep "API key authenticated"
```

### 7. Remove Legacy Keys (Optional)

Once all clients are using database keys, you can remove environment variables:
1. Remove `ADMIN_API_KEY`, `CLIENT_API_KEY`, `ANALYSIS_API_KEY` from `.env`
2. Restart services
3. Legacy validation will no longer work

## Management Commands

### Create API Key
```bash
node scripts/manage-api-keys.js create <role> [userId] [options]
  -d, --description <desc>     Description for the key
  -e, --expires <days>         Expiration in days
  -p, --permissions <perms...> Custom permissions
```

### List API Keys
```bash
node scripts/manage-api-keys.js list [userId]
  -a, --all  Show all keys (admin only)
```

### Revoke API Key
```bash
node scripts/manage-api-keys.js revoke <keyOrId>
  -r, --reason <reason>  Reason for revocation
```

### Validate API Key
```bash
node scripts/manage-api-keys.js validate <key>
```

## API Key Format

New API keys are:
- 64 characters long (base64url encoded)
- Prefixed for easy identification:
  - `athena-adm-` for admin keys
  - `athena-ana-` for analysis keys
  - `athena-cli-` for client keys

## Security Considerations

1. **Never Log Full Keys**: The system only logs first 8 characters
2. **Keys are One-Way Hashed**: Database stores SHA-256 hashes, not plain text
3. **Rate Limiting**: Configure per-key rate limits in database
4. **Expiration**: Set expiration dates for temporary keys
5. **Audit Trail**: All key operations logged in `security_events`

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
node -e "require('./services/database/connection').testConnection().then(console.log)"
```

### Key Validation Failing
1. Check database connectivity
2. Verify key exists and is active:
   ```sql
   SELECT key_prefix, is_active, expires_at 
   FROM athena_security.api_keys 
   WHERE key_hash = SHA256('your-key-here');
   ```

### Fallback Not Working
1. Ensure environment variables are set
2. Check logs for "Database unavailable, falling back"
3. Verify `LEGACY_API_KEYS` Set is populated

## Next Steps

After successful migration:
1. ✅ Implement user management interface (Web UI for key management)
2. ✅ Add key rotation policies
3. ✅ Integrate with monitoring for key usage analytics
4. ✅ Add webhook notifications for key events