use serde::{Deserialize, Serialize};
use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogMessage {
    level: String,
    message: String,
    data: Option<serde_json::Value>,
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorLog {
    message: String,
    error: String,
    stack: Option<String>,
    timestamp: String,
}

/// Get the application log directory
fn get_log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let log_dir = app.path().app_log_dir()
        .map_err(|e| format!("Failed to get log directory: {}", e))?;

    // Ensure directory exists
    create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    Ok(log_dir)
}

/// Log frontend messages to file
/// Per DeepWiki: Use app_log_dir() for proper log file location in Tauri apps
#[tauri::command]
pub async fn log_frontend_message(
    app: tauri::AppHandle,
    level: String,
    message: String,
    data: Option<serde_json::Value>,
    timestamp: String,
) -> Result<(), String> {
    let log_dir = get_log_dir(&app)?;
    let log_file = log_dir.join("frontend.log");

    let log_entry = LogMessage {
        level: level.clone(),
        message,
        data,
        timestamp,
    };

    let log_line = format!(
        "[{}] [{}] {}{}\n",
        log_entry.timestamp,
        log_entry.level.to_uppercase(),
        log_entry.message,
        log_entry.data.as_ref()
            .map(|d| format!(" | data: {}", serde_json::to_string(d).unwrap_or_default()))
            .unwrap_or_default()
    );

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_line.as_bytes())
        .map_err(|e| format!("Failed to write to log file: {}", e))?;

    // Also print to stderr for development
    #[cfg(debug_assertions)]
    eprintln!("[FRONTEND] {}", log_line.trim());

    Ok(())
}

/// Log frontend errors to file with stack traces
/// Critical errors are always logged, even in production
#[tauri::command]
pub async fn log_frontend_error(
    app: tauri::AppHandle,
    message: String,
    error: String,
    stack: Option<String>,
    timestamp: String,
) -> Result<(), String> {
    let log_dir = get_log_dir(&app)?;
    let error_file = log_dir.join("frontend-errors.log");

    let error_log = ErrorLog {
        message: message.clone(),
        error: error.clone(),
        stack: stack.clone(),
        timestamp: timestamp.clone(),
    };

    let log_line = format!(
        "[{}] [ERROR] {}\n  Error: {}\n{}\n---\n",
        error_log.timestamp,
        error_log.message,
        error_log.error,
        error_log.stack.as_ref()
            .map(|s| format!("  Stack:\n    {}", s.replace('\n', "\n    ")))
            .unwrap_or_default()
    );

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&error_file)
        .map_err(|e| format!("Failed to open error log file: {}", e))?;

    file.write_all(log_line.as_bytes())
        .map_err(|e| format!("Failed to write to error log file: {}", e))?;

    // Always print errors to stderr
    eprintln!("[FRONTEND ERROR] {} - {}", message, error);

    Ok(())
}
