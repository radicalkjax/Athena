/// Secure API Key Storage using System Keychain
///
/// This module provides secure storage for API keys using the system's native
/// keychain/credential manager (macOS Keychain, Windows Credential Manager, Linux Secret Service).
///
/// Security best practice: Never store API keys in plain text files.

use keyring::Entry;

/// Service name used for keychain entries
const SERVICE_NAME: &str = "athena-malware-analyzer";

/// Store an API key securely in the system keychain
///
/// # Arguments
/// * `provider` - Provider identifier (e.g., "claude", "openai", "deepseek")
/// * `api_key` - The API key to store securely
///
/// # Returns
/// * `Ok(())` if the key was stored successfully
/// * `Err(String)` with a descriptive error message if storage failed
///
/// # Security
/// - Keys are stored in the system's native credential manager
/// - macOS: Keychain Access
/// - Windows: Credential Manager
/// - Linux: Secret Service (libsecret)
pub fn store_api_key(provider: &str, api_key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, provider)
        .map_err(|e| format!("Failed to create keyring entry for provider '{}': {}", provider, e))?;

    entry.set_password(api_key)
        .map_err(|e| format!("Failed to store API key for provider '{}': {}", provider, e))?;

    Ok(())
}

/// Retrieve an API key from the system keychain
///
/// # Arguments
/// * `provider` - Provider identifier (e.g., "claude", "openai", "deepseek")
///
/// # Returns
/// * `Ok(Some(String))` if the key was found
/// * `Ok(None)` if no key is stored for this provider
/// * `Err(String)` with a descriptive error message if retrieval failed
pub fn get_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, provider)
        .map_err(|e| format!("Failed to create keyring entry for provider '{}': {}", provider, e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None), // No key stored - not an error
        Err(e) => Err(format!("Failed to retrieve API key for provider '{}': {}", provider, e)),
    }
}

/// Delete an API key from the system keychain
///
/// # Arguments
/// * `provider` - Provider identifier (e.g., "claude", "openai", "deepseek")
///
/// # Returns
/// * `Ok(())` if the key was deleted successfully or didn't exist
/// * `Err(String)` with a descriptive error message if deletion failed
pub fn delete_api_key(provider: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, provider)
        .map_err(|e| format!("Failed to create keyring entry for provider '{}': {}", provider, e))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted - not an error
        Err(e) => Err(format!("Failed to delete API key for provider '{}': {}", provider, e)),
    }
}

/// Check if an API key exists in the keychain
///
/// # Arguments
/// * `provider` - Provider identifier (e.g., "claude", "openai", "deepseek")
///
/// # Returns
/// * `Ok(true)` if a key exists for this provider
/// * `Ok(false)` if no key is stored
/// * `Err(String)` with a descriptive error message if the check failed
pub fn has_api_key(provider: &str) -> Result<bool, String> {
    match get_api_key(provider) {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_and_retrieve_api_key() {
        let test_provider = "test_provider_123";
        let test_key = "test_api_key_abc";

        // Clean up from any previous test runs
        let _ = delete_api_key(test_provider);

        // Store the key
        assert!(store_api_key(test_provider, test_key).is_ok());

        // Retrieve the key
        let retrieved = get_api_key(test_provider).unwrap();
        assert_eq!(retrieved, Some(test_key.to_string()));

        // Clean up
        assert!(delete_api_key(test_provider).is_ok());

        // Verify deletion
        let after_delete = get_api_key(test_provider).unwrap();
        assert_eq!(after_delete, None);
    }

    #[test]
    fn test_has_api_key() {
        let test_provider = "test_provider_456";
        let test_key = "test_api_key_def";

        // Clean up from any previous test runs
        let _ = delete_api_key(test_provider);

        // Should not exist initially
        assert_eq!(has_api_key(test_provider).unwrap(), false);

        // Store a key
        store_api_key(test_provider, test_key).unwrap();

        // Should exist now
        assert_eq!(has_api_key(test_provider).unwrap(), true);

        // Clean up
        delete_api_key(test_provider).unwrap();

        // Should not exist after deletion
        assert_eq!(has_api_key(test_provider).unwrap(), false);
    }

    #[test]
    fn test_delete_nonexistent_key() {
        let test_provider = "nonexistent_provider";

        // Deleting a key that doesn't exist should succeed (idempotent)
        assert!(delete_api_key(test_provider).is_ok());
    }

    #[test]
    fn test_retrieve_nonexistent_key() {
        let test_provider = "nonexistent_provider_789";

        // Clean up to ensure it doesn't exist
        let _ = delete_api_key(test_provider);

        // Retrieving a key that doesn't exist should return None
        let result = get_api_key(test_provider).unwrap();
        assert_eq!(result, None);
    }
}
