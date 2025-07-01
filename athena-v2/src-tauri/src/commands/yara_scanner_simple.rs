use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YaraScanResult {
    pub file_path: String,
    pub matches: Vec<YaraMatch>,
    pub scan_time_ms: u64,
    pub rules_loaded: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YaraMatch {
    pub rule_name: String,
    pub namespace: Option<String>,
    pub tags: Vec<String>,
    pub meta: HashMap<String, String>,
    pub strings: Vec<YaraStringMatch>,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YaraStringMatch {
    pub identifier: String,
    pub offset: u64,
    pub length: usize,
    pub matched_data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YaraRuleSet {
    pub name: String,
    pub rules_count: usize,
    pub categories: Vec<String>,
    pub loaded: bool,
}

#[tauri::command]
pub async fn initialize_yara_scanner() -> Result<String, String> {
    Ok("YARA scanner initialized successfully (simulated)".to_string())
}

#[tauri::command]
pub async fn load_yara_rules(_rules_content: String, _namespace: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn load_default_yara_rules() -> Result<Vec<YaraRuleSet>, String> {
    let rule_sets = vec![
        YaraRuleSet {
            name: "ransomware".to_string(),
            rules_count: 10,
            categories: vec!["ransomware".to_string(), "encryption".to_string()],
            loaded: true,
        },
        YaraRuleSet {
            name: "trojans".to_string(),
            rules_count: 15,
            categories: vec!["trojan".to_string(), "backdoor".to_string()],
            loaded: true,
        },
        YaraRuleSet {
            name: "exploits".to_string(),
            rules_count: 8,
            categories: vec!["exploit".to_string(), "vulnerability".to_string()],
            loaded: true,
        },
        YaraRuleSet {
            name: "packers".to_string(),
            rules_count: 12,
            categories: vec!["packer".to_string(), "crypter".to_string()],
            loaded: true,
        },
    ];
    
    Ok(rule_sets)
}

#[tauri::command]
pub async fn scan_file_with_yara(file_path: String) -> Result<YaraScanResult, String> {
    let start = std::time::Instant::now();
    
    // Simulate scanning
    let matches = if file_path.to_lowercase().contains("malware") || 
                     file_path.to_lowercase().contains("sample") {
        vec![
            YaraMatch {
                rule_name: "Emotet_Dropper".to_string(),
                namespace: Some("trojans".to_string()),
                tags: vec!["trojan".to_string(), "dropper".to_string()],
                meta: {
                    let mut meta = HashMap::new();
                    meta.insert("severity".to_string(), "critical".to_string());
                    meta.insert("description".to_string(), "Detects Emotet variants".to_string());
                    meta
                },
                strings: vec![
                    YaraStringMatch {
                        identifier: "$mz_header".to_string(),
                        offset: 0,
                        length: 2,
                        matched_data: Some("4D5A".to_string()),
                    },
                ],
                severity: "critical".to_string(),
            },
        ]
    } else {
        Vec::new()
    };
    
    Ok(YaraScanResult {
        file_path,
        matches,
        scan_time_ms: start.elapsed().as_millis() as u64,
        rules_loaded: 45,
        error: None,
    })
}

#[tauri::command]
pub async fn get_yara_rule_sets() -> Result<Vec<YaraRuleSet>, String> {
    load_default_yara_rules().await
}