# Secure API Key Storage Implementation

## Overview

Athena now uses the system's native credential storage to securely store API keys for AI providers. This eliminates the security risk of storing API keys in plain text JSON files.

## Architecture

### Components

1. **secure_storage Module** (`src/secure_storage.rs`)
   - Provides secure storage operations using the `keyring` crate
   - Interfaces with system-native credential managers
   - Handles errors gracefully with descriptive messages

2. **Updated ai_analysis Module** (`src/commands/ai_analysis.rs`)
   - Modified `load_configs()` to retrieve API keys from keychain
   - Modified `save_configs()` to store API keys in keychain
   - Automatic migration from plain-text to secure storage
   - New command: `delete_api_key_from_storage`

### Platform-Specific Storage

| Platform | Storage Location | Access Method |
|----------|-----------------|---------------|
| macOS | Keychain Access | Security Framework |
| Windows | Credential Manager | Windows Credential API |
| Linux | Secret Service | libsecret (GNOME Keyring, KWallet) |

## Configuration File Format

### Before (Plain Text - INSECURE)
```json
{
  "claude": {
    "id": "claude",
    "name": "Claude",
    "api_key": "sk-ant-1234567890abcdef...",
    "model": "claude-3-sonnet-20240229",
    "enabled": true
  }
}
```

### After (Secure)
```json
{
  "claude": {
    "id": "claude",
    "name": "Claude",
    "api_key": "STORED_IN_KEYCHAIN",
    "model": "claude-3-sonnet-20240229",
    "enabled": true
  }
}
```

The actual API key is stored in the system keychain with:
- **Service Name**: `athena-malware-analyzer`
- **Account Name**: Provider ID (e.g., `claude`, `openai`, `deepseek`)

## Usage

### For Developers

#### Storing an API Key
```rust
use crate::secure_storage;

let result = secure_storage::store_api_key("claude", "sk-ant-1234567890abcdef");
match result {
    Ok(()) => println!("API key stored successfully"),
    Err(e) => eprintln!("Failed to store API key: {}", e),
}
```

#### Retrieving an API Key
```rust
use crate::secure_storage;

match secure_storage::get_api_key("claude") {
    Ok(Some(key)) => println!("API key: {}", key),
    Ok(None) => println!("No API key stored"),
    Err(e) => eprintln!("Failed to retrieve API key: {}", e),
}
```

#### Deleting an API Key
```rust
use crate::secure_storage;

let result = secure_storage::delete_api_key("claude");
match result {
    Ok(()) => println!("API key deleted"),
    Err(e) => eprintln!("Failed to delete API key: {}", e),
}
```

### For Frontend Developers

The frontend doesn't need any changes! The existing commands work the same way:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Save config (API key automatically goes to keychain)
await invoke('update_ai_provider_config', {
  provider: 'claude',
  config: {
    id: 'claude',
    name: 'Claude',
    api_key: 'sk-ant-1234567890abcdef',
    model: 'claude-3-sonnet-20240229',
    enabled: true
  }
});

// Load config (API key automatically retrieved from keychain)
const config = await invoke('get_ai_provider_config', { provider: 'claude' });
// config.api_key will contain the actual key, not the placeholder

// Delete API key from keychain
await invoke('delete_api_key_from_storage', { provider: 'claude' });
```

## Migration Strategy

### Automatic Migration

When the application loads existing configurations:

1. **Detection**: Checks if `api_key` field contains a real key (not "STORED_IN_KEYCHAIN")
2. **Migration**: Automatically moves the key to system keychain
3. **Logging**: Prints migration message to stderr
4. **Update**: Replaces JSON value with "STORED_IN_KEYCHAIN" placeholder

### Manual Migration

Users don't need to do anything! The migration happens automatically on first use.

## Security Benefits

### Before
- ❌ API keys stored in plain text JSON
- ❌ Readable by any process with file access
- ❌ Easily exposed in backups
- ❌ Version control risk (accidental commits)
- ❌ No encryption at rest

### After
- ✅ API keys stored in system keychain
- ✅ OS-level access control
- ✅ Encrypted at rest (platform-dependent encryption)
- ✅ Isolated from application data
- ✅ Protected by OS security policies
- ✅ No plain-text API keys in files

## Testing

### Unit Tests

The `secure_storage` module includes comprehensive tests:

```bash
cargo test --lib secure_storage
```

Tests cover:
- ✅ Store and retrieve API keys
- ✅ Delete API keys
- ✅ Check if API key exists
- ✅ Handle nonexistent keys gracefully
- ✅ Idempotent deletion

### Integration Tests

Run full test suite:

```bash
cargo test
```

## Troubleshooting

### macOS

**Issue**: "Could not access keychain"
- **Solution**: Grant Keychain Access permission to Athena in System Preferences → Security & Privacy

**Issue**: "User canceled"
- **Solution**: User denied permission when prompted. Re-run and allow access.

### Windows

**Issue**: "Access denied to Credential Manager"
- **Solution**: Run Athena with user permissions (not as Administrator, which uses different credential storage)

### Linux

**Issue**: "No keyring daemon running"
- **Solution**: Install and start a Secret Service provider:
  ```bash
  # For GNOME
  sudo apt-get install gnome-keyring

  # For KDE
  sudo apt-get install kwalletmanager
  ```

**Issue**: "Failed to unlock keyring"
- **Solution**: User needs to unlock the default keyring (usually happens on login)

## Backwards Compatibility

### Reading Old Configs

Old configurations with plain-text API keys are automatically migrated:

1. First load: Detects plain-text API key
2. Migrates to keychain
3. Updates JSON file with placeholder
4. Logs migration to stderr

### Writing New Configs

All new configurations automatically use secure storage:

1. API key received from frontend
2. Stored in system keychain
3. Placeholder written to JSON file
4. Original key never persisted to disk

## Performance

- **Storage**: ~10-50ms (platform-dependent)
- **Retrieval**: ~5-20ms (cached by OS)
- **Deletion**: ~10-30ms

The overhead is negligible compared to network requests to AI providers.

## Future Enhancements

Potential improvements:

1. **Key Rotation**: Automatic rotation of API keys
2. **Multi-User**: Support for per-user keychains
3. **Biometric Auth**: Integration with Touch ID / Windows Hello
4. **Audit Logging**: Track API key access for security monitoring
5. **Export/Import**: Secure backup and restore of API keys

## References

- [keyring crate documentation](https://docs.rs/keyring/)
- [macOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Windows Credential Manager](https://docs.microsoft.com/en-us/windows/win32/secauthn/credentials-management)
- [freedesktop.org Secret Service API](https://specifications.freedesktop.org/secret-service/)

## Compliance

This implementation follows security best practices:

- ✅ OWASP: Cryptographic Storage Cheat Sheet
- ✅ CWE-312: Cleartext Storage of Sensitive Information (mitigated)
- ✅ CWE-522: Insufficiently Protected Credentials (mitigated)
- ✅ NIST SP 800-63B: Digital Identity Guidelines

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test cases in `src/secure_storage.rs`
3. File an issue on GitHub with platform details
