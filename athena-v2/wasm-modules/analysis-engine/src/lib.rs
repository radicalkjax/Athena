use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub file_type: String,
    pub entropy: f64,
    pub suspicious_strings: Vec<String>,
    pub api_calls: Vec<String>,
    pub hashes: HashMap<String, String>,
    pub risk_score: u32,
    pub techniques: Vec<String>,
}

#[wasm_bindgen]
pub fn analyze(data: &[u8]) -> String {
    console_log!("Analysis engine: processing {} bytes", data.len());
    
    let result = AnalysisResult {
        file_type: detect_file_type(data),
        entropy: calculate_entropy(data),
        suspicious_strings: find_suspicious_strings(data),
        api_calls: extract_api_calls(data),
        hashes: calculate_hashes(data),
        risk_score: calculate_risk_score(data),
        techniques: detect_techniques(data),
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn detect_file_type(data: &[u8]) -> String {
    if data.len() < 4 {
        return "Unknown".to_string();
    }
    
    match &data[0..4] {
        [0x4D, 0x5A, _, _] => "PE".to_string(),
        [0x7F, 0x45, 0x4C, 0x46] => "ELF".to_string(),
        [0xCF, 0xFA, 0xED, 0xFE] | [0xCE, 0xFA, 0xED, 0xFE] => "Mach-O".to_string(),
        [0x50, 0x4B, 0x03, 0x04] => "ZIP".to_string(),
        _ => "Unknown".to_string(),
    }
}

fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    
    let mut freq = [0u64; 256];
    for &byte in data {
        freq[byte as usize] += 1;
    }
    
    let len = data.len() as f64;
    let mut entropy = 0.0;
    
    for &count in &freq {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }
    
    entropy
}

fn find_suspicious_strings(data: &[u8]) -> Vec<String> {
    let mut strings = Vec::new();
    let patterns = vec![
        "CreateRemoteThread",
        "VirtualAllocEx",
        "WriteProcessMemory",
        "SetWindowsHookEx",
        "RegSetValueEx",
        "cmd.exe",
        "powershell",
        "WScript.Shell",
        "HKEY_",
        "\\System32\\",
        "\\Temp\\",
    ];
    
    let text = String::from_utf8_lossy(data);
    for pattern in patterns {
        if text.contains(pattern) {
            strings.push(pattern.to_string());
        }
    }
    
    strings
}

fn extract_api_calls(data: &[u8]) -> Vec<String> {
    let mut api_calls = Vec::new();
    let common_apis = vec![
        "kernel32.dll",
        "ntdll.dll",
        "user32.dll",
        "advapi32.dll",
        "ws2_32.dll",
        "wininet.dll",
    ];
    
    let text = String::from_utf8_lossy(data);
    for api in common_apis {
        if text.contains(api) {
            api_calls.push(api.to_string());
        }
    }
    
    api_calls
}

fn calculate_hashes(data: &[u8]) -> HashMap<String, String> {
    let mut hashes = HashMap::new();
    
    // SHA256
    let mut hasher = Sha256::new();
    hasher.update(data);
    let sha256_result = hasher.finalize();
    hashes.insert("sha256".to_string(), format!("{:x}", sha256_result));
    
    // MD5
    let md5_result = md5::compute(data);
    hashes.insert("md5".to_string(), format!("{:x}", md5_result));
    
    hashes
}

fn calculate_risk_score(data: &[u8]) -> u32 {
    let mut score = 0;
    
    // High entropy suggests encryption/packing
    let entropy = calculate_entropy(data);
    if entropy > 7.0 {
        score += 30;
    } else if entropy > 6.5 {
        score += 20;
    }
    
    // Suspicious strings
    let suspicious = find_suspicious_strings(data);
    score += (suspicious.len() as u32) * 10;
    
    // API calls
    let apis = extract_api_calls(data);
    score += (apis.len() as u32) * 5;
    
    // Cap at 100
    score.min(100)
}

fn detect_techniques(data: &[u8]) -> Vec<String> {
    let mut techniques = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // MITRE ATT&CK technique detection
    if text.contains("CreateRemoteThread") || text.contains("SetWindowsHookEx") {
        techniques.push("T1055 - Process Injection".to_string());
    }
    
    if text.contains("RegSetValueEx") || text.contains("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
        techniques.push("T1547.001 - Registry Run Keys".to_string());
    }
    
    if text.contains("schtasks") || text.contains("at.exe") {
        techniques.push("T1053 - Scheduled Task/Job".to_string());
    }
    
    if text.contains("WScript.Shell") || text.contains("powershell") {
        techniques.push("T1059 - Command and Scripting Interpreter".to_string());
    }
    
    techniques
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}