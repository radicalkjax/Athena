/// Example demonstrating secure API key storage
///
/// This example shows how to use the secure_storage module to safely
/// store and retrieve API keys using the system's native keychain.
///
/// Run with: cargo run --example secure_storage_example

use athena_v2::secure_storage;

fn main() {
    println!("=== Secure API Key Storage Example ===\n");

    let provider = "example_provider";
    let api_key = "sk-example-1234567890abcdef";

    // Step 1: Store an API key
    println!("1. Storing API key for '{}'...", provider);
    match secure_storage::store_api_key(provider, api_key) {
        Ok(()) => println!("   ✓ API key stored successfully in system keychain"),
        Err(e) => {
            eprintln!("   ✗ Failed to store API key: {}", e);
            return;
        }
    }

    // Step 2: Retrieve the API key
    println!("\n2. Retrieving API key for '{}'...", provider);
    match secure_storage::get_api_key(provider) {
        Ok(Some(retrieved_key)) => {
            println!("   ✓ API key retrieved successfully");
            if retrieved_key == api_key {
                println!("   ✓ Retrieved key matches original");
            } else {
                println!("   ✗ Retrieved key does not match!");
            }
        }
        Ok(None) => println!("   ✗ No API key found (unexpected)"),
        Err(e) => eprintln!("   ✗ Failed to retrieve API key: {}", e),
    }

    // Step 3: Check if key exists
    println!("\n3. Checking if API key exists...");
    match secure_storage::has_api_key(provider) {
        Ok(true) => println!("   ✓ API key exists in keychain"),
        Ok(false) => println!("   ✗ API key not found (unexpected)"),
        Err(e) => eprintln!("   ✗ Failed to check key existence: {}", e),
    }

    // Step 4: Delete the API key
    println!("\n4. Deleting API key for '{}'...", provider);
    match secure_storage::delete_api_key(provider) {
        Ok(()) => println!("   ✓ API key deleted successfully"),
        Err(e) => eprintln!("   ✗ Failed to delete API key: {}", e),
    }

    // Step 5: Verify deletion
    println!("\n5. Verifying deletion...");
    match secure_storage::get_api_key(provider) {
        Ok(None) => println!("   ✓ API key no longer exists (as expected)"),
        Ok(Some(_)) => println!("   ✗ API key still exists (unexpected)"),
        Err(e) => eprintln!("   ✗ Error checking key: {}", e),
    }

    // Step 6: Demonstrate idempotent deletion
    println!("\n6. Attempting to delete non-existent key...");
    match secure_storage::delete_api_key(provider) {
        Ok(()) => println!("   ✓ Delete succeeded (idempotent - OK to delete non-existent key)"),
        Err(e) => eprintln!("   ✗ Failed: {}", e),
    }

    println!("\n=== Example Complete ===");
    println!("\nPlatform-specific storage locations:");
    println!("  • macOS:   Keychain Access (service: athena-malware-analyzer)");
    println!("  • Windows: Credential Manager (target: athena-malware-analyzer)");
    println!("  • Linux:   Secret Service (GNOME Keyring/KWallet)");
    println!("\nYou can verify the stored credentials using your system's credential manager.");
}
