use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tauri::path::SafePathBuf;
use crate::metrics::{FILE_OPERATION_DURATION, FILE_OPERATION_COUNTER, FILE_SIZE_HISTOGRAM};

#[derive(Serialize, Deserialize, Clone)]
pub struct FileMetadata {
    name: String,
    size: u64,
    mime_type: String,
    hash: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UploadProgress {
    current: u64,
    total: u64,
    percentage: f32,
    status: String,
}

#[tauri::command]
pub async fn upload_file(app: AppHandle, path: SafePathBuf) -> Result<FileMetadata, String> {
    let start_time = Instant::now();

    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    if !file_path.exists() {
        FILE_OPERATION_COUNTER
            .with_label_values(&["upload_file", "error"])
            .inc();
        return Err("File not found".to_string());
    }

    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| {
            FILE_OPERATION_COUNTER
                .with_label_values(&["upload_file", "error"])
                .inc();
            format!("Failed to get file metadata: {}", e)
        })?;

    let file = File::open(&file_path)
        .map_err(|e| {
            FILE_OPERATION_COUNTER
                .with_label_values(&["upload_file", "error"])
                .inc();
            format!("Failed to open file: {}", e)
        })?;

    let total_size = metadata.len();
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 8192]; // 8KB chunks
    let mut bytes_read = 0u64;

    // Emit initial progress
    app.emit("upload-progress", UploadProgress {
        current: 0,
        total: total_size,
        percentage: 0.0,
        status: "starting".to_string(),
    }).ok();

    loop {
        let n = reader.read(&mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        if n == 0 {
            break;
        }

        hasher.update(&buffer[..n]);
        bytes_read += n as u64;

        let percentage = (bytes_read as f32 / total_size as f32) * 100.0;

        // Emit progress update
        app.emit("upload-progress", UploadProgress {
            current: bytes_read,
            total: total_size,
            percentage,
            status: "uploading".to_string(),
        }).ok();
    }

    let hash = hex::encode(hasher.finalize());

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    // Emit completion
    app.emit("upload-progress", UploadProgress {
        current: total_size,
        total: total_size,
        percentage: 100.0,
        status: "completed".to_string(),
    }).ok();

    // Record metrics
    let duration = start_time.elapsed();
    FILE_OPERATION_DURATION
        .with_label_values(&["upload_file", "success"])
        .observe(duration.as_secs_f64());

    FILE_OPERATION_COUNTER
        .with_label_values(&["upload_file", "success"])
        .inc();

    FILE_SIZE_HISTOGRAM
        .with_label_values(&["upload_file"])
        .observe(total_size as f64);

    Ok(FileMetadata {
        name: file_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        size: metadata.len(),
        mime_type,
        hash,
    })
}

#[tauri::command]
pub async fn get_file_metadata(path: SafePathBuf) -> Result<FileMetadata, String> {
    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let content = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&content);
    let hash = hex::encode(hasher.finalize());

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    Ok(FileMetadata {
        name: file_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        size: metadata.len(),
        mime_type,
        hash,
    })
}

#[tauri::command]
pub async fn read_file_binary(path: SafePathBuf, offset: usize, length: usize) -> Result<Vec<u8>, String> {
    use std::io::Seek;

    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let mut file = File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let file_size = file.metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len() as usize;

    let actual_length = std::cmp::min(length, file_size.saturating_sub(offset));

    let mut buffer = vec![0; actual_length];

    file.seek(std::io::SeekFrom::Start(offset as u64))
        .map_err(|e| format!("Failed to seek file: {}", e))?;

    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(buffer)
}

#[tauri::command]
pub async fn write_file_binary(path: SafePathBuf, data: Vec<u8>) -> Result<(), String> {
    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    std::fs::write(file_path, data)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn read_file_text(path: SafePathBuf) -> Result<String, String> {
    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_file_text(path: SafePathBuf, content: String) -> Result<(), String> {
    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let file_path = path.as_ref();

    std::fs::write(file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Create a temporary file in the app's data directory
/// Used for drag-and-drop file handling where the browser File API
/// doesn't provide a filesystem path
#[tauri::command]
pub async fn create_temp_file(
    app: AppHandle,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    // Get app data directory for temporary files
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create temp subdirectory
    let temp_dir = app_data_dir.join("temp");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Sanitize filename to prevent path traversal
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown_file");

    // Add timestamp to avoid collisions
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let temp_file_name = format!("{}_{}", timestamp, safe_name);
    let temp_path = temp_dir.join(&temp_file_name);

    // Write the file
    let mut file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    // Return the path as a string
    temp_path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}
