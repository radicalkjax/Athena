//! Sample management commands for secure file upload and staged analysis
//!
//! All files are treated as potential malware and stored in quarantine
//! until explicitly released for analysis.

use crate::quarantine::{QuarantineStorage, SampleMetadata, SampleStatus, FileType, QuarantineStats};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{State, AppHandle, Manager};

/// Validate that a path is within allowed directories to prevent directory traversal
fn validate_path(path: &str, app: &AppHandle) -> Result<PathBuf, String> {
    let path_buf = Path::new(path);

    // Canonicalize the path to resolve any .. or symlinks
    let canonical = path_buf.canonicalize()
        .map_err(|e| format!("Invalid path '{}': {}", path, e))?;

    // Get allowed directories
    let temp_dir = std::env::temp_dir();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let app_cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("Failed to get app cache directory: {}", e))?;
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;

    // Check if path is within any allowed directory
    let allowed_dirs = vec![temp_dir, app_data_dir, app_cache_dir, home_dir];

    for allowed in &allowed_dirs {
        if canonical.starts_with(allowed) {
            return Ok(canonical);
        }
    }

    Err(format!(
        "Path traversal detected: '{}' is outside allowed directories. Files must be in temp directory, app data directory, or user home directory.",
        path
    ))
}

/// Summary of a staged sample for the UI
#[derive(Debug, Serialize, Deserialize)]
pub struct SampleSummary {
    pub sha256: String,
    pub original_filename: String,
    pub size: u64,
    pub file_type: String,
    pub mime_type: String,
    pub status: String,
    pub uploaded_at: String,
    pub tags: Vec<String>,
}

impl From<SampleMetadata> for SampleSummary {
    fn from(m: SampleMetadata) -> Self {
        let file_type_str = match &m.file_type {
            FileType::PE { arch, is_dll } => {
                if *is_dll { format!("PE DLL ({})", arch) } else { format!("PE EXE ({})", arch) }
            }
            FileType::ELF { arch, bits } => format!("ELF{} ({})", bits, arch),
            FileType::MachO { arch } => format!("Mach-O ({})", arch),
            FileType::PDF => "PDF".to_string(),
            FileType::Office { format } => format!("Office ({})", format),
            FileType::Archive { format } => format!("Archive ({})", format),
            FileType::Script { language } => format!("Script ({})", language),
            FileType::Image { format } => format!("Image ({})", format),
            FileType::Text => "Text".to_string(),
            FileType::Unknown => "Unknown".to_string(),
        };

        SampleSummary {
            sha256: m.sha256,
            original_filename: m.original_filename,
            size: m.size,
            file_type: file_type_str,
            mime_type: m.mime_type,
            status: m.status.to_string(),
            uploaded_at: m.uploaded_at.to_rfc3339(),
            tags: m.tags,
        }
    }
}

/// Result of uploading a sample
#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub sha256: String,
    pub is_duplicate: bool,
    pub file_type: String,
    pub size: u64,
    pub message: String,
}

/// Register a new sample in quarantine storage
///
/// This uploads the file but does NOT start analysis.
/// The sample sits in "staged" status until explicitly analyzed.
#[tauri::command]
pub async fn register_sample(
    app: AppHandle,
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    file_path: String,
    original_filename: Option<String>,
) -> Result<UploadResult, String> {
    // Validate path to prevent directory traversal
    let validated_path = validate_path(&file_path, &app)?;

    // Read file data
    let data = tokio::fs::read(&validated_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Use original filename or extract from path
    let filename = original_filename.unwrap_or_else(|| {
        std::path::Path::new(&file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    });

    // Store in quarantine
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let stored = storage_guard
        .store_sample(&data, &filename)
        .map_err(|e| format!("Failed to store sample: {}", e))?;

    let file_type_str = match &stored.metadata.file_type {
        FileType::PE { arch, is_dll } => {
            if *is_dll { format!("PE DLL ({})", arch) } else { format!("PE EXE ({})", arch) }
        }
        FileType::ELF { arch, bits } => format!("ELF{} ({})", bits, arch),
        FileType::MachO { arch } => format!("Mach-O ({})", arch),
        FileType::PDF => "PDF".to_string(),
        FileType::Office { format } => format!("Office ({})", format),
        FileType::Archive { format } => format!("Archive ({})", format),
        FileType::Script { language } => format!("Script ({})", language),
        FileType::Image { format } => format!("Image ({})", format),
        FileType::Text => "Text".to_string(),
        FileType::Unknown => "Unknown".to_string(),
    };

    let message = if stored.is_duplicate {
        format!("Sample already exists ({})", &stored.sha256[..8])
    } else {
        format!("Sample registered successfully ({})", &stored.sha256[..8])
    };

    Ok(UploadResult {
        sha256: stored.sha256,
        is_duplicate: stored.is_duplicate,
        file_type: file_type_str,
        size: stored.metadata.size,
        message,
    })
}

/// List all staged samples (not yet analyzed)
#[tauri::command]
pub async fn list_staged_samples(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<Vec<SampleSummary>, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let samples = storage_guard
        .list_samples_by_status(SampleStatus::Staged)
        .map_err(|e| format!("Failed to list samples: {}", e))?;

    Ok(samples.into_iter().map(SampleSummary::from).collect())
}

/// List all samples regardless of status
#[tauri::command]
pub async fn list_all_samples(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<Vec<SampleSummary>, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let samples = storage_guard
        .list_samples()
        .map_err(|e| format!("Failed to list samples: {}", e))?;

    Ok(samples.into_iter().map(SampleSummary::from).collect())
}

/// Get detailed metadata for a specific sample
#[tauri::command]
pub async fn get_sample_metadata(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<SampleMetadata, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    storage_guard
        .load_metadata(&sha256)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .ok_or_else(|| format!("Sample not found: {}", sha256))
}

/// Delete a staged sample (marks for deletion)
#[tauri::command]
pub async fn delete_staged_sample(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    storage_guard
        .delete_sample(&sha256)
        .map_err(|e| format!("Failed to delete sample: {}", e))?;

    Ok(format!("Sample {} marked for deletion", &sha256[..8]))
}

/// Update sample tags
#[tauri::command]
pub async fn update_sample_tags(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
    tags: Vec<String>,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let mut metadata = storage_guard
        .load_metadata(&sha256)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .ok_or_else(|| format!("Sample not found: {}", sha256))?;

    metadata.tags = tags;
    storage_guard
        .update_metadata(&sha256, &metadata)
        .map_err(|e| format!("Failed to update metadata: {}", e))?;

    Ok("Tags updated".to_string())
}

/// Update sample notes
#[tauri::command]
pub async fn update_sample_notes(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
    notes: Option<String>,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let mut metadata = storage_guard
        .load_metadata(&sha256)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .ok_or_else(|| format!("Sample not found: {}", sha256))?;

    metadata.notes = notes;
    storage_guard
        .update_metadata(&sha256, &metadata)
        .map_err(|e| format!("Failed to update metadata: {}", e))?;

    Ok("Notes updated".to_string())
}

/// Start analysis for a staged sample
///
/// This marks the sample as "analyzing" and returns the quarantine path
/// that can be passed to the analysis commands.
#[tauri::command]
pub async fn start_sample_analysis(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;

    // Update status to analyzing
    let mut metadata = storage_guard
        .load_metadata(&sha256)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .ok_or_else(|| format!("Sample not found: {}", sha256))?;

    metadata.status = SampleStatus::Analyzing;
    metadata.analysis_count += 1;
    storage_guard
        .update_metadata(&sha256, &metadata)
        .map_err(|e| format!("Failed to update status: {}", e))?;

    // Stage the file for analysis (copy to staging dir)
    let staged_path = storage_guard
        .stage_for_analysis(&sha256)
        .map_err(|e| format!("Failed to stage sample: {}", e))?;

    Ok(staged_path.to_string_lossy().to_string())
}

/// Mark sample analysis as complete
#[tauri::command]
pub async fn complete_sample_analysis(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;

    let mut metadata = storage_guard
        .load_metadata(&sha256)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .ok_or_else(|| format!("Sample not found: {}", sha256))?;

    metadata.status = SampleStatus::Analyzed;
    storage_guard
        .update_metadata(&sha256, &metadata)
        .map_err(|e| format!("Failed to update status: {}", e))?;

    Ok("Analysis marked complete".to_string())
}

/// Clean up staging directory
#[tauri::command]
pub async fn cleanup_staging(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let count = storage_guard
        .cleanup_staging()
        .map_err(|e| format!("Failed to cleanup staging: {}", e))?;

    Ok(format!("Cleaned up {} staged files", count))
}

/// Permanently remove deleted samples
#[tauri::command]
pub async fn purge_deleted_samples(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    let count = storage_guard
        .cleanup_deleted()
        .map_err(|e| format!("Failed to purge samples: {}", e))?;

    Ok(format!("Permanently deleted {} samples", count))
}

/// Check if a sample exists by hash
#[tauri::command]
pub async fn sample_exists(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<bool, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    Ok(storage_guard.sample_exists(&sha256))
}

/// Get the quarantine storage path for a sample
#[tauri::command]
pub async fn get_sample_path(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;

    if !storage_guard.sample_exists(&sha256) {
        return Err(format!("Sample not found: {}", sha256));
    }

    let path = storage_guard.get_sample_path(&sha256);
    Ok(path.to_string_lossy().to_string())
}

/// Get quarantine storage statistics
#[tauri::command]
pub async fn get_quarantine_stats(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<QuarantineStats, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    storage_guard
        .get_storage_stats()
        .map_err(|e| format!("Failed to get storage stats: {}", e))
}

/// Get quarantine base directory path
#[tauri::command]
pub async fn get_quarantine_base_dir(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
) -> Result<String, String> {
    let storage_guard = storage.lock().map_err(|e| e.to_string())?;
    Ok(storage_guard.base_dir().to_string_lossy().to_string())
}

/// Read raw bytes of a quarantined sample (for hex viewer, re-analysis, export)
#[tauri::command]
pub async fn read_quarantined_sample(
    storage: State<'_, Arc<Mutex<QuarantineStorage>>>,
    sha256: String,
) -> Result<Vec<u8>, String> {
    let storage_guard = storage.lock().map_err(|e| format!("Storage lock error: {}", e))?;
    storage_guard.read_sample(&sha256)
        .map_err(|e| format!("Failed to read sample: {}", e))
}
