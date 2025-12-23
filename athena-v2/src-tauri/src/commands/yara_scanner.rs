use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::State;
use tauri::path::SafePathBuf;
use yara_x;
use crate::metrics::{YARA_SCAN_DURATION, YARA_MATCHES_FOUND, YARA_RULES_LOADED};
use super::yara_rules::{RANSOMWARE_RULES, TROJAN_RULES, EXPLOIT_RULES, PACKER_RULES};

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

    // Load built-in rule sets from yara_rules.rs
    let builtin_rules = vec![
        ("ransomware", RANSOMWARE_RULES),
        ("trojan", TROJAN_RULES),
        ("exploit", EXPLOIT_RULES),
        ("packer", PACKER_RULES),
    ];

    for (name, rules_str) in builtin_rules {
        compiler.new_namespace(name);
        if let Err(e) = compiler.add_source(rules_str) {
            eprintln!("Failed to load {} rules: {}", name, e);
        }
    }

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

    let is_loaded = state.rules.is_some();

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
                "exploit".to_string(),
                "packer".to_string(),
            ],
            loaded: is_loaded,
        },
    ];

    Ok(rule_sets)
}

#[tauri::command]
pub async fn scan_file_with_yara(
    yara_state: State<'_, Arc<Mutex<YaraState>>>,
    file_path: SafePathBuf,
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
    let data = std::fs::read(file_path.as_ref())
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

    let filename = file_path.as_ref().file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    Ok(YaraScanResult {
        file_path: filename,
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

/// Response from YARA rule validation
#[derive(Debug, Serialize, Deserialize)]
pub struct YaraRuleValidationResult {
    pub compilation: String,
    pub compilation_time_ms: u64,
    pub string_count: usize,
    pub condition_complexity: String,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn validate_yara_rule(
    rules_content: String,
) -> Result<YaraRuleValidationResult, String> {
    let start = Instant::now();
    let mut compiler = yara_x::Compiler::new();

    // Attempt to compile the rule
    let compile_result = compiler.add_source(rules_content.as_str());

    let compilation_time_ms = start.elapsed().as_millis() as u64;

    match compile_result {
        Ok(_) => {
            // Get any compilation warnings
            let warnings: Vec<String> = compiler.warnings().iter()
                .map(|w| format!("{}: {}", w.code(), w.title()))
                .collect();

            // Check for errors even on success
            let errors: Vec<String> = compiler.errors().iter()
                .map(|e| format!("{}: {}", e.code(), e.title()))
                .collect();

            if !errors.is_empty() {
                return Ok(YaraRuleValidationResult {
                    compilation: "Failed".to_string(),
                    compilation_time_ms,
                    string_count: 0,
                    condition_complexity: "N/A".to_string(),
                    warnings,
                    errors,
                });
            }

            // Build the rules to analyze them
            let _rules = compiler.build();

            // Count strings in the rule by analyzing the source
            let string_count = count_strings_in_rule(&rules_content);

            // Analyze condition complexity
            let condition_complexity = analyze_condition_complexity(&rules_content);

            Ok(YaraRuleValidationResult {
                compilation: "Success".to_string(),
                compilation_time_ms,
                string_count,
                condition_complexity,
                warnings,
                errors,
            })
        }
        Err(e) => {
            // Compilation failed
            let errors: Vec<String> = compiler.errors().iter()
                .map(|e| format!("{}: {}", e.code(), e.title()))
                .collect();

            Ok(YaraRuleValidationResult {
                compilation: "Failed".to_string(),
                compilation_time_ms,
                string_count: 0,
                condition_complexity: "N/A".to_string(),
                warnings: vec![],
                errors: if errors.is_empty() {
                    vec![e.to_string()]
                } else {
                    errors
                },
            })
        }
    }
}

/// Count the number of strings defined in a YARA rule
fn count_strings_in_rule(rule_content: &str) -> usize {
    let mut count = 0;
    let mut in_strings_section = false;

    for line in rule_content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("strings:") {
            in_strings_section = true;
            continue;
        }

        if trimmed.starts_with("condition:") {
            break;
        }

        if in_strings_section && trimmed.starts_with('$') {
            count += 1;
        }
    }

    count
}

/// Analyze the complexity of the condition block
fn analyze_condition_complexity(rule_content: &str) -> String {
    let mut in_condition_section = false;
    let mut condition_text = String::new();

    for line in rule_content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("condition:") {
            in_condition_section = true;
            continue;
        }

        if in_condition_section {
            if trimmed == "}" {
                break;
            }
            condition_text.push_str(trimmed);
            condition_text.push(' ');
        }
    }

    // Count logical operators to determine complexity
    let and_count = condition_text.matches(" and ").count();
    let or_count = condition_text.matches(" or ").count();
    let not_count = condition_text.matches(" not ").count();
    let total_operators = and_count + or_count + not_count;

    if total_operators == 0 {
        "Simple".to_string()
    } else if total_operators <= 2 {
        "Moderate".to_string()
    } else {
        "Complex".to_string()
    }
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

#[tauri::command]
pub async fn auto_generate_yara_rules(
    file_hash: String,
    file_type: String,
    suspicious_strings: Vec<String>,
    suspicious_imports: Vec<String>,
    behaviors: Vec<String>,
) -> Result<String, String> {
    // Generate a YARA rule based on the analysis results
    let rule_name = format!("Auto_Generated_{}",
        file_hash.chars().take(8).collect::<String>()
    );

    let mut rule = format!(r#"rule {} {{
    meta:
        description = "Auto-generated rule for {}"
        hash = "{}"
        generated = "{}"
        file_type = "{}"
"#,
        rule_name,
        file_type,
        file_hash,
        chrono::Utc::now().format("%Y-%m-%d"),
        file_type
    );

    // Add behavior metadata
    if !behaviors.is_empty() {
        rule.push_str("        behaviors = \"");
        rule.push_str(&behaviors.join(", "));
        rule.push_str("\"\n");
    }

    // Add strings section
    rule.push_str("\n    strings:\n");

    // Add suspicious strings (limit to 10 to keep rule manageable)
    let mut string_count = 0;
    for (i, s) in suspicious_strings.iter().take(10).enumerate() {
        if s.is_empty() {
            continue;
        }

        // Escape special characters for YARA
        let escaped = s
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");

        // Skip strings that are too short or contain only common characters
        if escaped.len() < 4 {
            continue;
        }

        rule.push_str(&format!("        $str{} = \"{}\" ascii wide\n", i, escaped));
        string_count += 1;
    }

    // Add suspicious imports as strings
    for (i, import) in suspicious_imports.iter().take(10).enumerate() {
        if import.is_empty() {
            continue;
        }

        let escaped = import
            .replace("\\", "\\\\")
            .replace("\"", "\\\"");

        rule.push_str(&format!("        $imp{} = \"{}\" ascii wide\n", i, escaped));
        string_count += 1;
    }

    // Ensure we have at least one string
    if string_count == 0 {
        rule.push_str("        $default = \"suspicious\" ascii wide\n");
    }

    // Add condition based on what we found
    rule.push_str("\n    condition:\n");

    if !suspicious_strings.is_empty() && !suspicious_imports.is_empty() {
        // If we have both strings and imports, require both
        rule.push_str("        (any of ($str*)) and (any of ($imp*))\n");
    } else if !suspicious_strings.is_empty() || !suspicious_imports.is_empty() {
        // If we have either, require any match
        rule.push_str("        any of them\n");
    } else {
        // Fallback condition
        rule.push_str("        any of them\n");
    }

    rule.push_str("}\n");

    Ok(rule)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auto_generate_yara_rules() {
        let file_hash = "1234567890abcdef".to_string();
        let file_type = "PE32".to_string();
        let suspicious_strings = vec![
            "CreateRemoteThread".to_string(),
            "VirtualAllocEx".to_string(),
            "WriteProcessMemory".to_string(),
        ];
        let suspicious_imports = vec![
            "kernel32.dll".to_string(),
            "ntdll.dll".to_string(),
        ];
        let behaviors = vec![
            "process_injection".to_string(),
            "suspicious_api_calls".to_string(),
        ];

        let result = auto_generate_yara_rules(
            file_hash.clone(),
            file_type.clone(),
            suspicious_strings.clone(),
            suspicious_imports.clone(),
            behaviors.clone(),
        ).await;

        assert!(result.is_ok());

        let rule = result.unwrap();

        // Verify rule structure
        assert!(rule.contains("rule Auto_Generated_12345678"));
        assert!(rule.contains(&format!("hash = \"{}\"", file_hash)));
        assert!(rule.contains(&format!("file_type = \"{}\"", file_type)));
        assert!(rule.contains("behaviors = \"process_injection, suspicious_api_calls\""));

        // Verify strings are included
        assert!(rule.contains("$str0 = \"CreateRemoteThread\""));
        assert!(rule.contains("$str1 = \"VirtualAllocEx\""));
        assert!(rule.contains("$str2 = \"WriteProcessMemory\""));

        // Verify imports are included
        assert!(rule.contains("$imp0 = \"kernel32.dll\""));
        assert!(rule.contains("$imp1 = \"ntdll.dll\""));

        // Verify condition
        assert!(rule.contains("condition:"));
        assert!(rule.contains("any of ($str*)) and (any of ($imp*)"));
    }

    #[tokio::test]
    async fn test_auto_generate_yara_rules_strings_only() {
        let result = auto_generate_yara_rules(
            "abcd1234".to_string(),
            "ELF64".to_string(),
            vec!["malicious_string".to_string()],
            vec![],
            vec![],
        ).await;

        assert!(result.is_ok());

        let rule = result.unwrap();
        assert!(rule.contains("$str0 = \"malicious_string\""));
        assert!(rule.contains("any of them"));
    }

    #[tokio::test]
    async fn test_auto_generate_yara_rules_escaping() {
        let result = auto_generate_yara_rules(
            "test123".to_string(),
            "PE32".to_string(),
            vec![r#"test\path"with"quotes"#.to_string()],
            vec![],
            vec![],
        ).await;

        assert!(result.is_ok());

        let rule = result.unwrap();
        // Verify escaping worked
        assert!(rule.contains(r#"test\\path\"with\"quotes"#));
    }

    #[tokio::test]
    async fn test_validate_yara_rule_success() {
        let valid_rule = r#"
rule Test_Rule {
    meta:
        description = "Test rule"
        author = "Test"
    strings:
        $str1 = "test"
        $str2 = "pattern"
    condition:
        $str1 and $str2
}
        "#;

        let result = validate_yara_rule(valid_rule.to_string()).await;
        assert!(result.is_ok());

        let validation = result.unwrap();
        assert_eq!(validation.compilation, "Success");
        assert_eq!(validation.string_count, 2);
        assert_eq!(validation.condition_complexity, "Simple");
        assert!(validation.errors.is_empty());
    }

    #[tokio::test]
    async fn test_validate_yara_rule_failure() {
        let invalid_rule = r#"
rule Invalid_Rule {
    strings:
        $str1 = "test"
    condition:
        $nonexistent_string
}
        "#;

        let result = validate_yara_rule(invalid_rule.to_string()).await;
        assert!(result.is_ok());

        let validation = result.unwrap();
        assert_eq!(validation.compilation, "Failed");
        assert!(!validation.errors.is_empty());
    }

    #[tokio::test]
    async fn test_count_strings_in_rule() {
        let rule = r#"
rule Test {
    strings:
        $a = "test1"
        $b = "test2"
        $c = { 00 11 22 }
    condition:
        any of them
}
        "#;

        let count = count_strings_in_rule(rule);
        assert_eq!(count, 3);
    }

    #[tokio::test]
    async fn test_analyze_condition_complexity() {
        let simple_rule = r#"
rule Simple {
    strings:
        $a = "test"
    condition:
        $a
}
        "#;
        assert_eq!(analyze_condition_complexity(simple_rule), "Simple");

        let moderate_rule = r#"
rule Moderate {
    strings:
        $a = "test"
        $b = "test2"
    condition:
        $a and $b
}
        "#;
        assert_eq!(analyze_condition_complexity(moderate_rule), "Simple");

        let complex_rule = r#"
rule Complex {
    strings:
        $a = "test"
        $b = "test2"
        $c = "test3"
    condition:
        ($a and $b) or ($b and $c) or not $a
}
        "#;
        assert_eq!(analyze_condition_complexity(complex_rule), "Complex");
    }

    #[tokio::test]
    #[ignore] // Requires Tauri State which cannot be constructed in unit tests
    async fn test_builtin_rules_loaded() {
        // This test requires a real Tauri State<> which can only be obtained from
        // a running Tauri application. The test validates the YARA initialization
        // logic but cannot be run in isolation.
        //
        // To test YARA functionality:
        // 1. Run the full application with `cargo tauri dev`
        // 2. Use the YARA scanner UI to verify rules are loaded
        // 3. Check that scanning detects expected patterns
    }

    #[tokio::test]
    #[ignore] // Requires Tauri State which cannot be constructed in unit tests
    async fn test_builtin_rules_namespaces() {
        // This test requires a real Tauri State<> and SafePathBuf which can only
        // be obtained from a running Tauri application.
        //
        // The test validates that:
        // 1. YARA rules from different namespaces (ransomware, trojan, etc.) are loaded
        // 2. Scanning files correctly matches patterns from the appropriate namespace
        // 3. Match results include the namespace information
        //
        // To verify this functionality, use integration tests or manual testing.
    }
}
