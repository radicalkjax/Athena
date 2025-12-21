use serde::{Deserialize, Serialize};
use std::env;
use sysinfo::System;

#[derive(Serialize, Deserialize)]
pub struct SystemStatus {
    platform: String,
    version: String,
    memory_usage: u64,
}

#[tauri::command]
pub fn get_system_status() -> Result<SystemStatus, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();

    let used_memory = sys.used_memory();

    Ok(SystemStatus {
        platform: env::consts::OS.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        memory_usage: used_memory,
    })
}