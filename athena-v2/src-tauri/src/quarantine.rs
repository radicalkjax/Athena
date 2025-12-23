//! Secure quarantine storage for malware samples
//!
//! All uploaded files are treated as potentially malicious and stored
//! with hash-based naming, restrictive permissions, and isolated from
//! the application code.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};

/// Sample status in the quarantine system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SampleStatus {
    /// Uploaded and staged, awaiting analysis
    Staged,
    /// At least one analysis job is running
    Analyzing,
    /// All analysis jobs complete
    Analyzed,
    /// Marked for deletion/cleanup
    Deleted,
}

impl std::fmt::Display for SampleStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SampleStatus::Staged => write!(f, "staged"),
            SampleStatus::Analyzing => write!(f, "analyzing"),
            SampleStatus::Analyzed => write!(f, "analyzed"),
            SampleStatus::Deleted => write!(f, "deleted"),
        }
    }
}

impl std::str::FromStr for SampleStatus {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "staged" => Ok(SampleStatus::Staged),
            "analyzing" => Ok(SampleStatus::Analyzing),
            "analyzed" => Ok(SampleStatus::Analyzed),
            "deleted" => Ok(SampleStatus::Deleted),
            _ => Err(format!("Unknown sample status: {}", s)),
        }
    }
}

/// Metadata for a quarantined sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleMetadata {
    pub sha256: String,
    pub sha1: String,
    pub md5: String,
    pub original_filename: String,
    pub sanitized_filename: String,
    pub size: u64,
    pub mime_type: String,
    pub file_type: FileType,
    pub uploaded_at: DateTime<Utc>,
    pub status: SampleStatus,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub analysis_count: u32,
}

/// Detected file type based on magic bytes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileType {
    PE { arch: String, is_dll: bool },
    ELF { arch: String, bits: u8 },
    MachO { arch: String },
    PDF,
    Office { format: String },
    Archive { format: String },
    Script { language: String },
    Image { format: String },
    Text,
    Unknown,
}

impl Default for FileType {
    fn default() -> Self {
        FileType::Unknown
    }
}

/// Result of storing a sample in quarantine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSample {
    pub sha256: String,
    pub quarantine_path: PathBuf,
    pub metadata: SampleMetadata,
    pub is_duplicate: bool,
}

/// Secure quarantine storage for malware samples
pub struct QuarantineStorage {
    base_dir: PathBuf,
    samples_dir: PathBuf,
    staging_dir: PathBuf,
    metadata_dir: PathBuf,
}

impl QuarantineStorage {
    /// Create a new quarantine storage in the specified app data directory
    pub fn new(app_data_dir: &Path) -> Result<Self> {
        let base_dir = app_data_dir.join("quarantine");
        let samples_dir = base_dir.join("samples");
        let staging_dir = base_dir.join("staging");
        let metadata_dir = base_dir.join("metadata");

        // Create directories with restricted permissions
        for dir in [&base_dir, &samples_dir, &staging_dir, &metadata_dir] {
            fs::create_dir_all(dir)
                .with_context(|| format!("Failed to create directory: {:?}", dir))?;

            // Set restrictive permissions (0700 - owner only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let permissions = fs::Permissions::from_mode(0o700);
                fs::set_permissions(dir, permissions)
                    .with_context(|| format!("Failed to set permissions on {:?}", dir))?;
            }
        }

        Ok(Self {
            base_dir,
            samples_dir,
            staging_dir,
            metadata_dir,
        })
    }

    /// Store a malware sample securely using hash-based naming
    pub fn store_sample(&self, data: &[u8], original_filename: &str) -> Result<StoredSample> {
        // Calculate hashes
        let sha256 = hex::encode(Sha256::digest(data));
        let sha1 = hex::encode(sha1::Sha1::digest(data));
        let md5 = hex::encode(md5::compute(data).0);

        // Check if sample already exists (deduplication)
        let sample_path = self.get_sample_path(&sha256);
        let is_duplicate = sample_path.exists();

        if !is_duplicate {
            // Create 2-level sharded directory structure: ab/cd/abcd123...
            let shard1 = &sha256[0..2];
            let shard2 = &sha256[2..4];
            let sample_dir = self.samples_dir.join(shard1).join(shard2);

            fs::create_dir_all(&sample_dir)
                .with_context(|| format!("Failed to create sample directory: {:?}", sample_dir))?;

            // Write sample with restricted permissions
            let sample_path = sample_dir.join(&sha256);
            let mut file = File::create(&sample_path)
                .with_context(|| format!("Failed to create sample file: {:?}", sample_path))?;
            file.write_all(data)
                .with_context(|| "Failed to write sample data")?;

            // Set read-only permissions (0400)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let permissions = fs::Permissions::from_mode(0o400);
                fs::set_permissions(&sample_path, permissions)
                    .with_context(|| "Failed to set file permissions")?;
            }

            // Set macOS quarantine extended attribute
            #[cfg(target_os = "macos")]
            {
                let _ = self.set_macos_quarantine_flag(&sample_path);
            }
        }

        // Detect file type from magic bytes
        let file_type = detect_file_type(data);
        let mime_type = detect_mime_type(data, original_filename);

        // Create metadata
        let metadata = SampleMetadata {
            sha256: sha256.clone(),
            sha1,
            md5,
            original_filename: original_filename.to_string(),
            sanitized_filename: sanitize_filename(original_filename),
            size: data.len() as u64,
            mime_type,
            file_type,
            uploaded_at: Utc::now(),
            status: SampleStatus::Staged,
            tags: Vec::new(),
            notes: None,
            analysis_count: if is_duplicate { 1 } else { 0 },
        };

        // Store metadata separately
        self.store_metadata(&sha256, &metadata)?;

        Ok(StoredSample {
            sha256,
            quarantine_path: self.get_sample_path(&metadata.sha256),
            metadata,
            is_duplicate,
        })
    }

    /// Get the path to a stored sample by its SHA256 hash
    pub fn get_sample_path(&self, sha256: &str) -> PathBuf {
        let shard1 = &sha256[0..2];
        let shard2 = &sha256[2..4];
        self.samples_dir.join(shard1).join(shard2).join(sha256)
    }

    /// Get the path to a sample's metadata file
    fn get_metadata_path(&self, sha256: &str) -> PathBuf {
        self.metadata_dir.join(format!("{}.json", sha256))
    }

    /// Store sample metadata as JSON
    fn store_metadata(&self, sha256: &str, metadata: &SampleMetadata) -> Result<()> {
        let path = self.get_metadata_path(sha256);
        let json = serde_json::to_string_pretty(metadata)
            .with_context(|| "Failed to serialize metadata")?;
        fs::write(&path, json)
            .with_context(|| format!("Failed to write metadata to {:?}", path))?;
        Ok(())
    }

    /// Load sample metadata from JSON
    pub fn load_metadata(&self, sha256: &str) -> Result<Option<SampleMetadata>> {
        let path = self.get_metadata_path(sha256);
        if !path.exists() {
            return Ok(None);
        }

        let json = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read metadata from {:?}", path))?;
        let metadata: SampleMetadata = serde_json::from_str(&json)
            .with_context(|| "Failed to parse metadata JSON")?;
        Ok(Some(metadata))
    }

    /// Update sample metadata
    pub fn update_metadata(&self, sha256: &str, metadata: &SampleMetadata) -> Result<()> {
        self.store_metadata(sha256, metadata)
    }

    /// Read sample data from quarantine
    pub fn read_sample(&self, sha256: &str) -> Result<Vec<u8>> {
        let path = self.get_sample_path(sha256);
        let mut file = File::open(&path)
            .with_context(|| format!("Failed to open sample: {:?}", path))?;
        let mut data = Vec::new();
        file.read_to_end(&mut data)
            .with_context(|| "Failed to read sample data")?;
        Ok(data)
    }

    /// Check if a sample exists by SHA256
    pub fn sample_exists(&self, sha256: &str) -> bool {
        self.get_sample_path(sha256).exists()
    }

    /// List all stored samples
    pub fn list_samples(&self) -> Result<Vec<SampleMetadata>> {
        let mut samples = Vec::new();

        for entry in fs::read_dir(&self.metadata_dir)
            .with_context(|| "Failed to read metadata directory")?
        {
            let entry = entry?;
            let path = entry.path();

            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(stem) = path.file_stem() {
                    if let Some(sha256) = stem.to_str() {
                        if let Ok(Some(metadata)) = self.load_metadata(sha256) {
                            samples.push(metadata);
                        }
                    }
                }
            }
        }

        // Sort by upload time (newest first)
        samples.sort_by(|a, b| b.uploaded_at.cmp(&a.uploaded_at));

        Ok(samples)
    }

    /// List samples by status
    pub fn list_samples_by_status(&self, status: SampleStatus) -> Result<Vec<SampleMetadata>> {
        let all = self.list_samples()?;
        Ok(all.into_iter().filter(|s| s.status == status).collect())
    }

    /// Delete a sample (marks as deleted, actual cleanup is separate)
    pub fn delete_sample(&self, sha256: &str) -> Result<()> {
        if let Some(mut metadata) = self.load_metadata(sha256)? {
            metadata.status = SampleStatus::Deleted;
            self.update_metadata(sha256, &metadata)?;
        }
        Ok(())
    }

    /// Permanently remove deleted samples (cleanup)
    pub fn cleanup_deleted(&self) -> Result<usize> {
        let deleted = self.list_samples_by_status(SampleStatus::Deleted)?;
        let mut count = 0;

        for sample in deleted {
            let sample_path = self.get_sample_path(&sample.sha256);
            let metadata_path = self.get_metadata_path(&sample.sha256);

            // Remove sample file
            if sample_path.exists() {
                // Make writable before deletion on Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = fs::set_permissions(&sample_path, fs::Permissions::from_mode(0o600));
                }
                fs::remove_file(&sample_path).ok();
            }

            // Remove metadata file
            if metadata_path.exists() {
                fs::remove_file(&metadata_path).ok();
            }

            count += 1;
        }

        Ok(count)
    }

    /// Stage a file to temporary location for analysis
    pub fn stage_for_analysis(&self, sha256: &str) -> Result<PathBuf> {
        let source = self.get_sample_path(sha256);
        if !source.exists() {
            anyhow::bail!("Sample not found: {}", sha256);
        }

        let staged_path = self.staging_dir.join(sha256);

        // Copy to staging (don't move, keep original in quarantine)
        fs::copy(&source, &staged_path)
            .with_context(|| "Failed to stage sample")?;

        // Set read-only on staged copy
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = fs::Permissions::from_mode(0o400);
            let _ = fs::set_permissions(&staged_path, permissions);
        }

        Ok(staged_path)
    }

    /// Clean up staging directory
    pub fn cleanup_staging(&self) -> Result<usize> {
        let mut count = 0;

        for entry in fs::read_dir(&self.staging_dir)? {
            let entry = entry?;
            // Make writable before deletion on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(entry.path(), fs::Permissions::from_mode(0o600));
            }
            if fs::remove_file(entry.path()).is_ok() {
                count += 1;
            }
        }

        Ok(count)
    }

    /// Set macOS quarantine extended attribute
    #[cfg(target_os = "macos")]
    fn set_macos_quarantine_flag(&self, path: &Path) -> Result<()> {
        use std::process::Command;

        // Set com.apple.quarantine extended attribute
        let output = Command::new("xattr")
            .args(["-w", "com.apple.quarantine", "0000;00000000;Athena;"])
            .arg(path)
            .output()?;

        if !output.status.success() {
            eprintln!("Warning: Failed to set macOS quarantine flag");
        }

        Ok(())
    }

    /// Get quarantine base directory
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Get disk usage statistics for the quarantine directory
    pub fn get_storage_stats(&self) -> Result<QuarantineStats> {
        let mut total_size = 0u64;
        let mut sample_count = 0usize;

        // Walk through samples directory
        if self.samples_dir.exists() {
            for entry in fs::read_dir(&self.samples_dir)? {
                let entry = entry?;
                if entry.path().is_file() {
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                        sample_count += 1;
                    }
                }
            }
        }

        // Get base directory metadata for timestamps
        let base_metadata = fs::metadata(&self.base_dir)?;
        let created_at = base_metadata.created()
            .unwrap_or_else(|_| std::time::SystemTime::now());

        Ok(QuarantineStats {
            total_size_bytes: total_size,
            sample_count,
            base_dir: self.base_dir.clone(),
            created_at,
        })
    }
}

/// Statistics about quarantine storage
#[derive(Debug, Serialize)]
pub struct QuarantineStats {
    pub total_size_bytes: u64,
    pub sample_count: usize,
    pub base_dir: PathBuf,
    pub created_at: std::time::SystemTime,
}

/// Validate path to prevent directory traversal (used in tests only)
#[cfg(test)]
pub fn validate_path(path: &str, base_dir: &Path) -> Result<PathBuf> {
    // Reject obviously malicious patterns
    if path.contains("..") || path.contains('~') {
        anyhow::bail!("Path contains invalid components");
    }

    // Parse path and check components
    let path_obj = Path::new(path);
    for component in path_obj.components() {
        match component {
            std::path::Component::ParentDir
            | std::path::Component::RootDir
            | std::path::Component::Prefix(_) => {
                anyhow::bail!("Path traversal attempt detected");
            }
            _ => {}
        }
    }

    // Canonicalize and verify it's within base directory
    let canonical = base_dir
        .join(path)
        .canonicalize()
        .with_context(|| "Invalid path")?;

    if !canonical.starts_with(base_dir) {
        anyhow::bail!("Path escapes quarantine directory");
    }

    Ok(canonical)
}

/// Sanitize filename to prevent exploits
/// Removes path separators, special characters, and limits length
pub fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .take(255)
        .collect()
}

/// Detect file type using the `infer` crate for comprehensive magic byte detection
/// Falls back to text/script detection for non-binary files
pub fn detect_file_type(data: &[u8]) -> FileType {
    if data.is_empty() {
        return FileType::Unknown;
    }

    // First, try the `infer` crate for binary file detection
    if let Some(kind) = infer::get(data) {
        return match kind.matcher_type() {
            infer::MatcherType::App => {
                // Executables
                match kind.mime_type() {
                    "application/x-executable" | "application/x-elf" => {
                        let bits = if data.len() > 4 && data[4] == 2 { 64 } else { 32 };
                        FileType::ELF {
                            arch: if bits == 64 { "x86_64" } else { "x86" }.to_string(),
                            bits,
                        }
                    }
                    "application/x-mach-binary" | "application/x-mach-o-executable" => {
                        FileType::MachO { arch: "x86_64".to_string() }
                    }
                    "application/vnd.microsoft.portable-executable" | "application/x-msdownload" => {
                        let is_dll = detect_pe_is_dll(data);
                        FileType::PE { arch: "x86/x64".to_string(), is_dll }
                    }
                    "application/x-dex" => FileType::Script { language: "Android DEX".to_string() },
                    "application/java-archive" => FileType::Archive { format: "JAR".to_string() },
                    "application/vnd.android.package-archive" => FileType::Archive { format: "APK".to_string() },
                    "application/wasm" => FileType::Script { language: "WebAssembly".to_string() },
                    _ => FileType::Unknown,
                }
            }
            infer::MatcherType::Archive => {
                FileType::Archive { format: kind.extension().to_uppercase() }
            }
            infer::MatcherType::Audio => {
                FileType::Script { language: format!("Audio ({})", kind.extension().to_uppercase()) }
            }
            infer::MatcherType::Book => {
                match kind.extension() {
                    "epub" => FileType::Archive { format: "EPUB".to_string() },
                    "mobi" => FileType::Script { language: "Mobi eBook".to_string() },
                    _ => FileType::Text,
                }
            }
            infer::MatcherType::Doc => {
                match kind.mime_type() {
                    "application/pdf" => FileType::PDF,
                    m if m.contains("officedocument") || m.contains("msword") || m.contains("ms-excel") || m.contains("ms-powerpoint") => {
                        FileType::Office { format: kind.extension().to_uppercase() }
                    }
                    "application/rtf" => FileType::Office { format: "RTF".to_string() },
                    _ => FileType::Text,
                }
            }
            infer::MatcherType::Font => {
                FileType::Script { language: format!("Font ({})", kind.extension().to_uppercase()) }
            }
            infer::MatcherType::Image => {
                FileType::Image { format: kind.extension().to_uppercase() }
            }
            infer::MatcherType::Text => {
                // infer detected it as text, check for specific types
                detect_text_subtype(data)
            }
            infer::MatcherType::Video => {
                FileType::Script { language: format!("Video ({})", kind.extension().to_uppercase()) }
            }
            infer::MatcherType::Custom => FileType::Unknown,
        };
    }

    // infer didn't match - check for text/script files
    detect_text_subtype(data)
}

/// Detect PE DLL flag from characteristics
fn detect_pe_is_dll(data: &[u8]) -> bool {
    if data.len() <= 0x3C + 4 {
        return false;
    }
    if let Some(pe_offset_bytes) = data.get(0x3C..0x3C + 4) {
        let pe_offset = u32::from_le_bytes([
            pe_offset_bytes[0],
            pe_offset_bytes[1],
            pe_offset_bytes[2],
            pe_offset_bytes[3],
        ]) as usize;

        if let Some(characteristics_bytes) = data.get(pe_offset + 22..pe_offset + 24) {
            let characteristics = u16::from_le_bytes([
                characteristics_bytes[0],
                characteristics_bytes[1],
            ]);
            return characteristics & 0x2000 != 0; // IMAGE_FILE_DLL
        }
    }
    false
}

/// Detect specific text file subtypes (SVG, HTML, XML, JSON, scripts, etc.)
fn detect_text_subtype(data: &[u8]) -> FileType {
    if data.is_empty() {
        return FileType::Unknown;
    }

    // Check if it's text-like first
    if !is_text_file(data) {
        return FileType::Unknown;
    }

    // Convert first 2KB to string for pattern matching
    let sample_size = data.len().min(2048);
    let content = String::from_utf8_lossy(&data[..sample_size]);
    let lower = content.to_lowercase();
    let trimmed = lower.trim_start();

    // SVG detection
    if trimmed.starts_with("<svg") || lower.contains("<svg ") ||
       lower.contains("xmlns=\"http://www.w3.org/2000/svg\"") ||
       lower.contains("xmlns='http://www.w3.org/2000/svg'") {
        return FileType::Script { language: "SVG".to_string() };
    }

    // HTML detection
    if trimmed.starts_with("<!doctype html") || trimmed.starts_with("<html") ||
       (lower.contains("<head") && lower.contains("<body")) ||
       (lower.contains("<html") && lower.contains("</html>")) {
        return FileType::Script { language: "HTML".to_string() };
    }

    // XML detection
    if trimmed.starts_with("<?xml") ||
       (trimmed.starts_with("<") && lower.contains("</") && !lower.contains("<html")) {
        return FileType::Script { language: "XML".to_string() };
    }

    // JSON detection
    if (trimmed.starts_with("{") && lower.contains("\":")) ||
       (trimmed.starts_with("[") && (lower.contains("{") || lower.contains("\""))) {
        return FileType::Script { language: "JSON".to_string() };
    }

    // YAML detection
    if lower.contains("---\n") || (lower.contains(": ") && lower.contains("\n  ")) {
        return FileType::Script { language: "YAML".to_string() };
    }

    // TOML detection
    if lower.contains("[package]") || lower.contains("[dependencies]") ||
       (lower.contains(" = \"") && lower.contains("[")) {
        return FileType::Script { language: "TOML".to_string() };
    }

    // CSS detection
    if (lower.contains("{") && lower.contains("}")) &&
       (lower.contains("color:") || lower.contains("font-") ||
        lower.contains("margin:") || lower.contains("padding:") ||
        lower.contains("display:") || lower.contains("@media") ||
        lower.contains("@import") || lower.contains("@keyframes")) {
        return FileType::Script { language: "CSS".to_string() };
    }

    // Check for shebang scripts
    if content.starts_with("#!") {
        let first_line = content.lines().next().unwrap_or("");
        if first_line.contains("python") {
            return FileType::Script { language: "Python".to_string() };
        } else if first_line.contains("bash") || first_line.contains("/sh") {
            return FileType::Script { language: "Shell".to_string() };
        } else if first_line.contains("node") || first_line.contains("bun") || first_line.contains("deno") {
            return FileType::Script { language: "JavaScript".to_string() };
        } else if first_line.contains("ruby") {
            return FileType::Script { language: "Ruby".to_string() };
        } else if first_line.contains("perl") {
            return FileType::Script { language: "Perl".to_string() };
        } else if first_line.contains("php") {
            return FileType::Script { language: "PHP".to_string() };
        }
        return FileType::Script { language: "Script".to_string() };
    }

    // PHP detection
    if lower.contains("<?php") || lower.starts_with("<?") {
        return FileType::Script { language: "PHP".to_string() };
    }

    // JavaScript/TypeScript detection
    if lower.contains("function ") || lower.contains("const ") || lower.contains("let ") ||
       lower.contains("import ") || lower.contains("export ") || lower.contains("require(") ||
       lower.contains("=>") || lower.contains("async ") {
        if lower.contains(": string") || lower.contains(": number") || lower.contains(": boolean") ||
           lower.contains("interface ") || lower.contains("<t>") || lower.contains(": any") {
            return FileType::Script { language: "TypeScript".to_string() };
        }
        return FileType::Script { language: "JavaScript".to_string() };
    }

    // Python detection
    if lower.contains("def ") || lower.contains("import ") || lower.contains("from ") ||
       lower.contains("class ") || lower.contains("if __name__") {
        return FileType::Script { language: "Python".to_string() };
    }

    // Rust detection
    if lower.contains("fn ") && (lower.contains("let ") || lower.contains("pub ") || lower.contains("mod ")) {
        return FileType::Script { language: "Rust".to_string() };
    }

    // Go detection
    if lower.contains("package ") && lower.contains("func ") {
        return FileType::Script { language: "Go".to_string() };
    }

    // C/C++ detection
    if lower.contains("#include") || lower.contains("int main(") || lower.contains("void main(") {
        if lower.contains("iostream") || lower.contains("std::") || lower.contains("namespace") {
            return FileType::Script { language: "C++".to_string() };
        }
        return FileType::Script { language: "C".to_string() };
    }

    // Java detection
    if lower.contains("public class ") || lower.contains("public static void main") {
        return FileType::Script { language: "Java".to_string() };
    }

    // SQL detection
    if lower.contains("select ") && lower.contains(" from ") ||
       lower.contains("create table") || lower.contains("insert into") {
        return FileType::Script { language: "SQL".to_string() };
    }

    // Markdown detection
    if trimmed.starts_with("# ") || trimmed.starts_with("## ") ||
       lower.contains("\n# ") || lower.contains("\n## ") ||
       lower.contains("```") || lower.contains("](") {
        return FileType::Text; // Markdown is considered plain text
    }

    // INI/Config detection
    if lower.contains("[") && lower.contains("]") && lower.contains("=") {
        return FileType::Script { language: "INI".to_string() };
    }

    // PowerShell detection
    if lower.contains("$env:") || lower.contains("-executionpolicy") ||
       lower.contains("get-") || lower.contains("set-") || lower.contains("new-object") {
        return FileType::Script { language: "PowerShell".to_string() };
    }

    // Batch file detection
    if lower.contains("@echo off") || lower.contains("goto ") || lower.contains("%~") {
        return FileType::Script { language: "Batch".to_string() };
    }

    // Default to plain text
    FileType::Text
}

/// Check if data looks like a text file
fn is_text_file(data: &[u8]) -> bool {
    if data.is_empty() {
        return false;
    }

    // Check first 1KB for text-like content
    let sample_size = data.len().min(1024);
    let sample = &data[..sample_size];

    // Count printable ASCII and common control characters
    let printable_count = sample
        .iter()
        .filter(|&&b| {
            b.is_ascii_graphic()
                || b.is_ascii_whitespace()
                || b == b'\r'
                || b == b'\n'
                || b == b'\t'
        })
        .count();

    // If >90% is printable, likely text
    printable_count as f64 / sample_size as f64 > 0.9
}

/// Detect MIME type from data and filename
fn detect_mime_type(data: &[u8], filename: &str) -> String {
    // First try magic bytes
    let file_type = detect_file_type(data);

    match file_type {
        FileType::PE { .. } => "application/x-msdownload".to_string(),
        FileType::ELF { .. } => "application/x-executable".to_string(),
        FileType::MachO { .. } => "application/x-mach-binary".to_string(),
        FileType::PDF => "application/pdf".to_string(),
        FileType::Office { .. } => {
            // Determine specific Office type from extension
            let ext = Path::new(filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            match ext.as_str() {
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                _ => "application/vnd.openxmlformats-officedocument",
            }.to_string()
        }
        FileType::Archive { ref format } => match format.as_str() {
            "ZIP" => "application/zip".to_string(),
            "RAR" => "application/x-rar-compressed".to_string(),
            "GZIP" => "application/gzip".to_string(),
            _ => "application/octet-stream".to_string(),
        },
        FileType::Image { ref format } => match format.as_str() {
            "PNG" => "image/png".to_string(),
            "JPEG" => "image/jpeg".to_string(),
            "GIF" => "image/gif".to_string(),
            _ => "image/unknown".to_string(),
        },
        FileType::Script { .. } => "text/plain".to_string(),
        FileType::Text => "text/plain".to_string(),
        FileType::Unknown => {
            // Fall back to extension-based detection
            mime_guess::from_path(filename)
                .first_or_octet_stream()
                .to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("malware.exe"), "malware.exe");
        assert_eq!(sanitize_filename("../../../etc/passwd"), "etcpasswd");
        assert_eq!(sanitize_filename("file with spaces.doc"), "filewithspaces.doc");
        assert_eq!(sanitize_filename("file<script>.exe"), "filescript.exe");
    }

    #[test]
    fn test_detect_file_type_pe() {
        let pe_data = b"MZ\x90\x00\x03\x00\x00\x00";
        let file_type = detect_file_type(pe_data);
        assert!(matches!(file_type, FileType::PE { .. }));
    }

    #[test]
    fn test_detect_file_type_elf() {
        let elf_data = b"\x7FELF\x02\x01\x01\x00";
        let file_type = detect_file_type(elf_data);
        assert!(matches!(file_type, FileType::ELF { bits: 64, .. }));
    }

    #[test]
    fn test_detect_file_type_text() {
        let text_data = b"Hello, this is a plain text file with some content.\n";
        let file_type = detect_file_type(text_data);
        assert!(matches!(file_type, FileType::Text));
    }

    #[test]
    fn test_quarantine_storage() {
        let temp_dir = TempDir::new().unwrap();
        let storage = QuarantineStorage::new(temp_dir.path()).unwrap();

        let sample_data = b"MZ\x90\x00This is fake PE data for testing";
        let stored = storage.store_sample(sample_data, "test_malware.exe").unwrap();

        assert!(!stored.sha256.is_empty());
        assert!(!stored.is_duplicate);
        assert!(storage.sample_exists(&stored.sha256));

        // Test deduplication
        let stored2 = storage.store_sample(sample_data, "test_malware_copy.exe").unwrap();
        assert!(stored2.is_duplicate);
        assert_eq!(stored.sha256, stored2.sha256);
    }

}
