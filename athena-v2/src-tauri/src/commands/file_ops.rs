use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct FileMetadata {
    name: String,
    size: u64,
    mime_type: String,
    hash: String,
}

#[derive(Serialize, Deserialize)]
pub struct UploadProgress {
    current: u64,
    total: u64,
    percentage: f32,
}

#[tauri::command]
pub async fn upload_file(path: String) -> Result<FileMetadata, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    let content = fs::read(&file_path)
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
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    upload_file(path).await
}