//! Volatility 3 integration for memory forensics
//!
//! This module provides integration with Volatility 3 for analyzing memory dumps.
//! It uses subprocess execution to call the vol3 CLI tool, which provides:
//! - Process listing and analysis
//! - Injected code detection (malfind)
//! - Network connection enumeration
//! - DLL and module listing
//! - API hook detection
//!
//! # Requirements
//! - Volatility 3 must be installed: `pip install volatility3`
//! - vol3 or vol.py must be in PATH

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tokio::process::Command as AsyncCommand;

/// Results from Volatility 3 analysis
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VolatilityAnalysis {
    pub processes: Vec<VolProcess>,
    pub network_connections: Vec<VolNetConn>,
    pub malfind_results: Vec<MalfindHit>,
    pub loaded_modules: Vec<ModuleInfo>,
    pub api_hooks: Vec<ApiHook>,
    pub handles: Vec<HandleInfo>,
    pub analysis_time_ms: u64,
    pub volatility_version: String,
}

/// Process information from pslist/pstree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolProcess {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
    pub path: Option<String>,
    pub create_time: Option<String>,
    pub exit_time: Option<String>,
    pub session_id: Option<u32>,
    pub wow64: bool,
}

/// Network connection from netscan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolNetConn {
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub state: String,
    pub pid: u32,
    pub owner_process: String,
}

/// Malfind hit - potential injected code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MalfindHit {
    pub pid: u32,
    pub process_name: String,
    pub address: u64,
    pub size: u64,
    pub protection: String,
    pub vad_tag: String,
    pub disassembly: Vec<String>,
    pub hex_dump: Vec<String>,
    pub likely_shellcode: bool,
}

/// Loaded module/DLL information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub name: String,
    pub path: String,
    pub base_address: u64,
    pub size: u64,
    pub pid: u32,
}

/// API hook detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiHook {
    pub function_name: String,
    pub module: String,
    pub hook_address: u64,
    pub target_address: u64,
    pub hook_type: String,
    pub pid: u32,
    pub process_name: String,
}

/// Handle information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleInfo {
    pub pid: u32,
    pub handle: u64,
    pub object_type: String,
    pub granted_access: String,
    pub name: Option<String>,
}

/// Volatility runner configuration
#[derive(Debug, Clone)]
pub struct VolatilityConfig {
    /// Path to vol3 or vol.py executable
    pub vol_path: PathBuf,
    /// Plugins to run
    pub plugins: Vec<String>,
    /// Output format (json, csv, text)
    pub output_format: String,
    /// Timeout in seconds
    pub timeout_secs: u64,
}

impl Default for VolatilityConfig {
    fn default() -> Self {
        Self {
            vol_path: Self::find_volatility_path(),
            plugins: vec![
                "windows.pslist".to_string(),
                "windows.malfind".to_string(),
                "windows.netscan".to_string(),
            ],
            output_format: "json".to_string(),
            timeout_secs: 300, // 5 minutes default
        }
    }
}

impl VolatilityConfig {
    /// Find Volatility 3 in common locations
    fn find_volatility_path() -> PathBuf {
        // Check common paths
        let candidates = [
            "vol3",
            "vol.py",
            "volatility3",
            "/usr/local/bin/vol3",
            "/usr/bin/vol3",
            "/opt/volatility3/vol.py",
            "python3 -m volatility3",
        ];

        for candidate in &candidates {
            if Self::check_vol_available(candidate) {
                return PathBuf::from(candidate);
            }
        }

        // Default to vol3, will error if not found
        PathBuf::from("vol3")
    }

    fn check_vol_available(path: &str) -> bool {
        Command::new(path)
            .arg("--help")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

/// Volatility 3 runner
pub struct VolatilityRunner {
    config: VolatilityConfig,
}

impl VolatilityRunner {
    pub fn new() -> Self {
        Self {
            config: VolatilityConfig::default(),
        }
    }

    pub fn with_config(config: VolatilityConfig) -> Self {
        Self { config }
    }

    /// Check if Volatility 3 is available
    pub fn is_available(&self) -> bool {
        Command::new(&self.config.vol_path)
            .arg("--help")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Get Volatility version
    pub fn get_version(&self) -> Result<String, String> {
        let output = Command::new(&self.config.vol_path)
            .arg("--version")
            .output()
            .map_err(|e| format!("Failed to run Volatility: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("Failed to get Volatility version".to_string())
        }
    }

    /// Analyze a memory dump with default plugins from config
    pub async fn analyze_dump_default(&self, dump_path: &Path) -> Result<VolatilityAnalysis, String> {
        let plugin_refs: Vec<&str> = self.config.plugins.iter().map(|s| s.as_str()).collect();
        self.analyze_dump(dump_path, &plugin_refs).await
    }

    /// Analyze a memory dump with specified plugins
    pub async fn analyze_dump(
        &self,
        dump_path: &Path,
        plugins: &[&str],
    ) -> Result<VolatilityAnalysis, String> {
        let start = std::time::Instant::now();

        // Validate dump file exists
        if !dump_path.exists() {
            let filename = dump_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());
            return Err(format!("Dump file not found: {}", filename));
        }

        let mut analysis = VolatilityAnalysis::default();
        analysis.volatility_version = self.get_version().unwrap_or_else(|_| "unknown".to_string());

        // Run each plugin
        for plugin in plugins {
            match *plugin {
                "pslist" | "windows.pslist" => {
                    analysis.processes = self.run_pslist(dump_path).await?;
                }
                "malfind" | "windows.malfind" => {
                    analysis.malfind_results = self.run_malfind(dump_path).await?;
                }
                "netscan" | "windows.netscan" => {
                    analysis.network_connections = self.run_netscan(dump_path).await?;
                }
                "dlllist" | "windows.dlllist" => {
                    analysis.loaded_modules = self.run_dlllist(dump_path).await?;
                }
                "handles" | "windows.handles" => {
                    analysis.handles = self.run_handles(dump_path).await?;
                }
                _ => {
                    // Unknown plugin, skip
                }
            }
        }

        analysis.analysis_time_ms = start.elapsed().as_millis() as u64;
        Ok(analysis)
    }

    /// Run pslist plugin
    async fn run_pslist(&self, dump_path: &Path) -> Result<Vec<VolProcess>, String> {
        let output = self
            .run_plugin(dump_path, "windows.pslist", &[])
            .await?;

        // Parse JSON output
        self.parse_pslist_output(&output)
    }

    /// Run malfind plugin
    async fn run_malfind(&self, dump_path: &Path) -> Result<Vec<MalfindHit>, String> {
        let output = self
            .run_plugin(dump_path, "windows.malfind", &[])
            .await?;

        self.parse_malfind_output(&output)
    }

    /// Run netscan plugin
    async fn run_netscan(&self, dump_path: &Path) -> Result<Vec<VolNetConn>, String> {
        let output = self
            .run_plugin(dump_path, "windows.netscan", &[])
            .await?;

        self.parse_netscan_output(&output)
    }

    /// Run dlllist plugin
    async fn run_dlllist(&self, dump_path: &Path) -> Result<Vec<ModuleInfo>, String> {
        let output = self
            .run_plugin(dump_path, "windows.dlllist", &[])
            .await?;

        self.parse_dlllist_output(&output)
    }

    /// Run handles plugin
    async fn run_handles(&self, dump_path: &Path) -> Result<Vec<HandleInfo>, String> {
        let output = self
            .run_plugin(dump_path, "windows.handles", &[])
            .await?;

        self.parse_handles_output(&output)
    }

    /// Run a Volatility plugin and get output
    async fn run_plugin(
        &self,
        dump_path: &Path,
        plugin: &str,
        extra_args: &[&str],
    ) -> Result<String, String> {
        let mut cmd = AsyncCommand::new(&self.config.vol_path);
        cmd.arg("-f")
            .arg(dump_path)
            .arg(plugin);

        // Add output format from config
        cmd.arg(format!("--{}", &self.config.output_format));

        for arg in extra_args {
            cmd.arg(arg);
        }

        let output = tokio::time::timeout(
            std::time::Duration::from_secs(self.config.timeout_secs),
            cmd.output(),
        )
        .await
        .map_err(|_| format!("Volatility plugin {} timed out", plugin))?
        .map_err(|e| format!("Failed to run Volatility: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Plugin {} failed: {}", plugin, stderr))
        }
    }

    /// Parse pslist JSON output
    fn parse_pslist_output(&self, output: &str) -> Result<Vec<VolProcess>, String> {
        // Volatility 3 JSON output is line-delimited JSON objects
        let mut processes = Vec::new();

        for line in output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            // Try to parse as JSON
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(array) = obj.as_array() {
                    for item in array {
                        if let Some(proc) = self.parse_process_entry(item) {
                            processes.push(proc);
                        }
                    }
                } else if let Some(proc) = self.parse_process_entry(&obj) {
                    processes.push(proc);
                }
            }
        }

        Ok(processes)
    }

    fn parse_process_entry(&self, obj: &serde_json::Value) -> Option<VolProcess> {
        Some(VolProcess {
            pid: obj.get("PID")?.as_u64()? as u32,
            ppid: obj.get("PPID").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            name: obj.get("ImageFileName")?.as_str()?.to_string(),
            path: obj.get("Path").and_then(|v| v.as_str()).map(String::from),
            create_time: obj.get("CreateTime").and_then(|v| v.as_str()).map(String::from),
            exit_time: obj.get("ExitTime").and_then(|v| v.as_str()).map(String::from),
            session_id: obj.get("SessionId").and_then(|v| v.as_u64()).map(|v| v as u32),
            wow64: obj.get("Wow64").and_then(|v| v.as_bool()).unwrap_or(false),
        })
    }

    /// Parse malfind JSON output
    fn parse_malfind_output(&self, output: &str) -> Result<Vec<MalfindHit>, String> {
        let mut hits = Vec::new();

        for line in output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(array) = obj.as_array() {
                    for item in array {
                        if let Some(hit) = self.parse_malfind_entry(item) {
                            hits.push(hit);
                        }
                    }
                } else if let Some(hit) = self.parse_malfind_entry(&obj) {
                    hits.push(hit);
                }
            }
        }

        Ok(hits)
    }

    fn parse_malfind_entry(&self, obj: &serde_json::Value) -> Option<MalfindHit> {
        let disasm: Vec<String> = obj
            .get("Disasm")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let hex: Vec<String> = obj
            .get("Hexdump")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        // Check for shellcode indicators
        let likely_shellcode = self.detect_shellcode_patterns(&disasm, &hex);

        Some(MalfindHit {
            pid: obj.get("PID")?.as_u64()? as u32,
            process_name: obj.get("Process")?.as_str()?.to_string(),
            address: obj.get("Start VPN").and_then(|v| v.as_u64()).unwrap_or(0),
            size: obj.get("Size").and_then(|v| v.as_u64()).unwrap_or(0),
            protection: obj.get("Protection").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            vad_tag: obj.get("Tag").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            disassembly: disasm,
            hex_dump: hex,
            likely_shellcode,
        })
    }

    /// Detect common shellcode patterns
    fn detect_shellcode_patterns(&self, disasm: &[String], hex: &[String]) -> bool {
        // Check for common shellcode patterns
        let shellcode_indicators = [
            "call", "jmp", "push", "pop", "xor eax, eax", "mov eax",
            "GetProcAddress", "LoadLibrary", "VirtualAlloc", "CreateThread",
            "NtCreateThread", "WinExec", "system",
        ];

        let hex_patterns = [
            "fc e8", // Common x86 shellcode start
            "90 90 90", // NOP sled
            "eb fe", // Infinite loop
            "31 c0", // xor eax, eax
            "31 db", // xor ebx, ebx
            "31 c9", // xor ecx, ecx
        ];

        // Check disassembly
        for line in disasm {
            let lower = line.to_lowercase();
            for indicator in &shellcode_indicators {
                if lower.contains(&indicator.to_lowercase()) {
                    return true;
                }
            }
        }

        // Check hex dump
        for line in hex {
            let lower = line.to_lowercase();
            for pattern in &hex_patterns {
                if lower.contains(pattern) {
                    return true;
                }
            }
        }

        false
    }

    /// Parse netscan JSON output
    fn parse_netscan_output(&self, output: &str) -> Result<Vec<VolNetConn>, String> {
        let mut connections = Vec::new();

        for line in output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(array) = obj.as_array() {
                    for item in array {
                        if let Some(conn) = self.parse_netscan_entry(item) {
                            connections.push(conn);
                        }
                    }
                } else if let Some(conn) = self.parse_netscan_entry(&obj) {
                    connections.push(conn);
                }
            }
        }

        Ok(connections)
    }

    fn parse_netscan_entry(&self, obj: &serde_json::Value) -> Option<VolNetConn> {
        Some(VolNetConn {
            protocol: obj.get("Proto")?.as_str()?.to_string(),
            local_address: obj.get("LocalAddr").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            local_port: obj.get("LocalPort").and_then(|v| v.as_u64()).unwrap_or(0) as u16,
            remote_address: obj.get("ForeignAddr").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            remote_port: obj.get("ForeignPort").and_then(|v| v.as_u64()).unwrap_or(0) as u16,
            state: obj.get("State").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            pid: obj.get("PID").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            owner_process: obj.get("Owner").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        })
    }

    /// Parse dlllist JSON output
    fn parse_dlllist_output(&self, output: &str) -> Result<Vec<ModuleInfo>, String> {
        let mut modules = Vec::new();

        for line in output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(array) = obj.as_array() {
                    for item in array {
                        if let Some(module) = self.parse_module_entry(item) {
                            modules.push(module);
                        }
                    }
                } else if let Some(module) = self.parse_module_entry(&obj) {
                    modules.push(module);
                }
            }
        }

        Ok(modules)
    }

    fn parse_module_entry(&self, obj: &serde_json::Value) -> Option<ModuleInfo> {
        Some(ModuleInfo {
            name: obj.get("Name")?.as_str()?.to_string(),
            path: obj.get("Path").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            base_address: obj.get("Base").and_then(|v| v.as_u64()).unwrap_or(0),
            size: obj.get("Size").and_then(|v| v.as_u64()).unwrap_or(0),
            pid: obj.get("PID").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        })
    }

    /// Parse handles JSON output
    fn parse_handles_output(&self, output: &str) -> Result<Vec<HandleInfo>, String> {
        let mut handles = Vec::new();

        for line in output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(array) = obj.as_array() {
                    for item in array {
                        if let Some(handle) = self.parse_handle_entry(item) {
                            handles.push(handle);
                        }
                    }
                } else if let Some(handle) = self.parse_handle_entry(&obj) {
                    handles.push(handle);
                }
            }
        }

        Ok(handles)
    }

    fn parse_handle_entry(&self, obj: &serde_json::Value) -> Option<HandleInfo> {
        Some(HandleInfo {
            pid: obj.get("PID")?.as_u64()? as u32,
            handle: obj.get("Handle").and_then(|v| v.as_u64()).unwrap_or(0),
            object_type: obj.get("Type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            granted_access: obj.get("GrantedAccess").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: obj.get("Name").and_then(|v| v.as_str()).map(String::from),
        })
    }
}

impl Default for VolatilityRunner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shellcode_patterns() {
        let runner = VolatilityRunner::new();

        // Test with NOP sled
        let hex_with_nop = vec!["90 90 90 90 90".to_string()];
        assert!(runner.detect_shellcode_patterns(&[], &hex_with_nop));

        // Test with common shellcode start
        let hex_with_fc = vec!["fc e8 00 00 00".to_string()];
        assert!(runner.detect_shellcode_patterns(&[], &hex_with_fc));

        // Test with clean hex
        let clean_hex = vec!["48 89 5c 24 08".to_string()];
        assert!(!runner.detect_shellcode_patterns(&[], &clean_hex));
    }

    #[test]
    fn test_config_default() {
        let config = VolatilityConfig::default();
        assert!(!config.plugins.is_empty());
        assert_eq!(config.output_format, "json");
        assert_eq!(config.timeout_secs, 300);
    }
}
