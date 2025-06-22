use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize, Deserialize)]
pub struct SystemStatus {
    platform: String,
    version: String,
    memory_usage: u64,
}

#[tauri::command]
pub fn get_system_status() -> Result<SystemStatus, String> {
    Ok(SystemStatus {
        platform: env::consts::OS.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        memory_usage: 0, // Placeholder - would implement actual memory monitoring
    })
}