use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::State;
use yara_x;
use crate::metrics::{YARA_SCAN_DURATION, YARA_MATCHES_FOUND, YARA_RULES_LOADED};

/// Global state for compiled YARA rules
pub struct YaraState {
    pub rules: Option<yara_x::Rules>,
    pub rules_count: usize,
}

impl YaraState {
    pub fn new() -> Self {
        YaraState {
            rules: None,
            rules_count: 0,
        }
    }
}

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
pub async fn initialize_yara_scanner(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
) -> Result<String, String> {
    // Load default YARA rules
    let mut compiler = yara_x::Compiler::new();

    // Add default malware detection rules
    let default_rules = r#"
rule Suspicious_Executable {
    meta:
        description = "Detects suspicious executable patterns"
        author = "Athena"
        severity = "medium"
    strings:
        $mz = { 4D 5A }
        $pe = "PE\x00\x00"
    condition:
        $mz at 0 and $pe
}

rule Suspicious_API_Calls {
    meta:
        description = "Detects suspicious Windows API calls"
        author = "Athena"
        severity = "high"
    strings:
        $api1 = "CreateRemoteThread" ascii wide
        $api2 = "WriteProcessMemory" ascii wide
        $api3 = "VirtualAllocEx" ascii wide
        $api4 = "SetWindowsHookEx" ascii wide
    condition:
        2 of ($api*)
}

rule Ransomware_Indicators {
    meta:
        description = "Detects potential ransomware behavior"
        author = "Athena"
        severity = "critical"
    strings:
        $crypt1 = "CryptEncrypt" ascii wide
        $crypt2 = "CryptDecrypt" ascii wide
        $ransom1 = "ransom" ascii wide nocase
        $ransom2 = "decrypt" ascii wide nocase
        $ransom3 = ".locked" ascii wide
        $ransom4 = ".encrypted" ascii wide
    condition:
        ($crypt1 or $crypt2) and 1 of ($ransom*)
}

rule Network_Communication {
    meta:
        description = "Detects network communication capabilities"
        author = "Athena"
        severity = "medium"
    strings:
        $net1 = "InternetOpen" ascii wide
        $net2 = "InternetConnect" ascii wide
        $net3 = "HttpSendRequest" ascii wide
        $net4 = "URLDownloadToFile" ascii wide
        $net5 = "WinHttpOpen" ascii wide
    condition:
        2 of them
}

rule Persistence_Mechanism {
    meta:
        description = "Detects persistence mechanisms"
        author = "Athena"
        severity = "high"
    strings:
        $reg1 = "CurrentVersion\\Run" ascii wide
        $reg2 = "CurrentVersion\\RunOnce" ascii wide
        $svc1 = "CreateService" ascii wide
        $task1 = "schtasks" ascii wide
    condition:
        any of them
}

rule Anti_Analysis {
    meta:
        description = "Detects anti-analysis techniques"
        author = "Athena"
        severity = "high"
    strings:
        $dbg1 = "IsDebuggerPresent" ascii wide
        $dbg2 = "CheckRemoteDebuggerPresent" ascii wide
        $vm1 = "VMware" ascii wide nocase
        $vm2 = "VirtualBox" ascii wide nocase
        $vm3 = "QEMU" ascii wide nocase
        $sandbox1 = "sample" ascii wide
        $sandbox2 = "sandbox" ascii wide nocase
    condition:
        2 of them
}

rule Code_Injection {
    meta:
        description = "Detects code injection techniques"
        author = "Athena"
        severity = "critical"
    strings:
        $inj1 = "CreateRemoteThread" ascii wide
        $inj2 = "NtCreateThreadEx" ascii wide
        $inj3 = "RtlCreateUserThread" ascii wide
        $mem1 = "VirtualAllocEx" ascii wide
        $mem2 = "WriteProcessMemory" ascii wide
    condition:
        1 of ($inj*) and 1 of ($mem*)
}

rule Packer_UPX {
    meta:
        description = "Detects UPX packer"
        author = "Athena"
        severity = "medium"
    strings:
        $upx1 = "UPX0" ascii
        $upx2 = "UPX1" ascii
        $upx3 = "UPX!" ascii
    condition:
        any of them
}

rule Cryptocurrency_Miner {
    meta:
        description = "Detects cryptocurrency mining indicators"
        author = "Athena"
        severity = "high"
    strings:
        $coin1 = "bitcoin" ascii wide nocase
        $coin2 = "monero" ascii wide nocase
        $coin3 = "ethereum" ascii wide nocase
        $wallet1 = "wallet" ascii wide nocase
        $pool1 = "pool" ascii wide nocase
        $miner1 = "stratum" ascii wide
    condition:
        1 of ($coin*) and (1 of ($wallet*) or 1 of ($pool*) or $miner1)
}

rule Keylogger_Indicators {
    meta:
        description = "Detects keylogger behavior"
        author = "Athena"
        severity = "high"
    strings:
        $hook1 = "SetWindowsHookEx" ascii wide
        $hook2 = "GetAsyncKeyState" ascii wide
        $hook3 = "GetKeyState" ascii wide
        $log1 = "keylog" ascii wide nocase
    condition:
        (1 of ($hook*)) or $log1
}
"#;

    compiler.add_source(default_rules)
        .map_err(|e| format!("Failed to compile default rules: {}", e))?;

    let rules = compiler.build();
    let rules_count = count_rules(&rules);

    let mut state = yara_state.lock()
        .map_err(|e| format!("Failed to lock YARA state: {}", e))?;

    state.rules = Some(rules);
    state.rules_count = rules_count;

    // Record metrics for loaded default rules
    YARA_RULES_LOADED
        .with_label_values(&["default"])
        .set(rules_count as f64);

    Ok(format!("YARA scanner initialized with {} default rules", rules_count))
}

#[tauri::command]
pub async fn load_yara_rules(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
    rules_content: String,
    namespace: Option<String>,
) -> Result<(), String> {
    let mut compiler = yara_x::Compiler::new();

    // If namespace is provided, create it
    if let Some(ns) = namespace {
        compiler.new_namespace(&ns);
    }

    // Add the new rules
    compiler.add_source(rules_content.as_str())
        .map_err(|e| format!("Failed to compile rules: {}", e))?;

    // Check for compilation errors
    let errors = compiler.errors();
    if !errors.is_empty() {
        let error_msg = errors.iter()
            .map(|e| format!("{}: {}", e.code(), e.title()))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!("Compilation errors: {}", error_msg));
    }

    let rules = compiler.build();
    let rules_count = count_rules(&rules);

    let mut state = yara_state.lock()
        .map_err(|e| format!("Failed to lock YARA state: {}", e))?;

    state.rules = Some(rules);
    state.rules_count = rules_count;

    // Record metrics for loaded rules
    YARA_RULES_LOADED
        .with_label_values(&["custom"])
        .set(rules_count as f64);

    Ok(())
}

#[tauri::command]
pub async fn load_default_yara_rules(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
) -> Result<Vec<YaraRuleSet>, String> {
    let state = yara_state.lock()
        .map_err(|e| format!("Failed to lock YARA state: {}", e))?;

    let rule_sets = vec![
        YaraRuleSet {
            name: "default-malware-rules".to_string(),
            rules_count: state.rules_count,
            categories: vec![
                "malware".to_string(),
                "ransomware".to_string(),
                "trojan".to_string(),
                "persistence".to_string(),
                "anti-analysis".to_string(),
            ],
            loaded: state.rules.is_some(),
        },
    ];

    Ok(rule_sets)
}

#[tauri::command]
pub async fn scan_file_with_yara(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
    file_path: String,
) -> Result<YaraScanResult, String> {
    let start = Instant::now();

    // Get compiled rules from state
    let state = yara_state.lock()
        .map_err(|e| {
            YARA_SCAN_DURATION
                .with_label_values(&["default", "error"])
                .observe(start.elapsed().as_secs_f64());
            format!("Failed to lock YARA state: {}", e)
        })?;

    let rules = state.rules.as_ref()
        .ok_or_else(|| {
            YARA_SCAN_DURATION
                .with_label_values(&["default", "error"])
                .observe(start.elapsed().as_secs_f64());
            "YARA rules not initialized. Call initialize_yara_scanner first.".to_string()
        })?;

    let rules_loaded = state.rules_count;

    // Read file
    let data = std::fs::read(&file_path)
        .map_err(|e| {
            YARA_SCAN_DURATION
                .with_label_values(&["default", "error"])
                .observe(start.elapsed().as_secs_f64());
            format!("Failed to read file: {}", e)
        })?;

    // Create scanner with compiled rules
    let mut scanner = yara_x::Scanner::new(rules);

    // Scan the data
    let scan_results = scanner.scan(&data)
        .map_err(|e| format!("Scan failed: {}", e))?;

    let scan_time_ms = start.elapsed().as_millis() as u64;

    // Convert YARA-X results to our format
    let mut matches = Vec::new();

    for rule in scan_results.matching_rules() {
        let mut meta = HashMap::new();

        // Extract metadata
        for (key, value) in rule.metadata() {
            let value_str = match value {
                yara_x::MetaValue::Integer(i) => i.to_string(),
                yara_x::MetaValue::Float(f) => f.to_string(),
                yara_x::MetaValue::Bool(b) => b.to_string(),
                yara_x::MetaValue::String(s) => s.to_string(),
                yara_x::MetaValue::Bytes(b) => format!("{:?}", b),
            };
            meta.insert(key.to_string(), value_str);
        }

        // Extract matched strings
        let mut strings = Vec::new();
        for pattern in rule.patterns() {
            for m in pattern.matches() {
                let range = m.range();
                let matched_bytes = m.data();

                strings.push(YaraStringMatch {
                    identifier: pattern.identifier().to_string(),
                    offset: range.start as u64,
                    length: matched_bytes.len(),
                    matched_data: String::from_utf8(matched_bytes.to_vec()).ok(),
                });
            }
        }

        matches.push(YaraMatch {
            rule_name: rule.identifier().to_string(),
            namespace: Some(rule.namespace().to_string()),
            tags: vec![], // YARA-X doesn't expose tags in the current API
            meta: meta.clone(),
            strings,
        });

        // Record match metrics by severity
        let severity = meta.get("severity")
            .map(|s| s.as_str())
            .unwrap_or("unknown");

        YARA_MATCHES_FOUND
            .with_label_values(&["default", severity])
            .inc();
    }

    // Record successful scan metrics
    let duration = start.elapsed();
    YARA_SCAN_DURATION
        .with_label_values(&["default", "success"])
        .observe(duration.as_secs_f64());

    Ok(YaraScanResult {
        file_path,
        matches,
        scan_time_ms,
        rules_loaded,
        error: None,
    })
}

#[tauri::command]
pub async fn get_yara_rule_sets(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
) -> Result<Vec<YaraRuleSet>, String> {
    load_default_yara_rules(yara_state).await
}

/// Helper function to count rules in a compiled Rules object
fn count_rules(rules: &yara_x::Rules) -> usize {
    // Create a temporary scanner to inspect the rules
    let mut scanner = yara_x::Scanner::new(rules);

    // Scan empty data to get all non-matching rules
    match scanner.scan(&[]) {
        Ok(scan_results) => {
            // Count both matching and non-matching rules
            let matching_count = scan_results.matching_rules().count();
            let non_matching_count = scan_results.non_matching_rules().count();
            matching_count + non_matching_count
        }
        Err(_) => 0, // If scan fails, return 0
    }
}
