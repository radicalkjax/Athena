use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tauri::{AppHandle, Emitter};

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
pub async fn upload_file(app: AppHandle, path: String) -> Result<FileMetadata, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    
    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    let file = File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
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
    let file_path = Path::new(&path);
    
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
pub async fn read_file_binary(path: String, offset: usize, length: usize) -> Result<Vec<u8>, String> {
    use std::io::Seek;
    
    let file_path = Path::new(&path);
    
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
pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    std::fs::write(&file_path, data)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn read_file_text(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_file_text(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}