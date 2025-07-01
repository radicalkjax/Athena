use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct PatternMatchInput {
    pub data: String, // Base64 encoded data
    pub length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct PatternMatchResult {
    pub success: bool,
    pub total_matches: usize,
    pub matches: Vec<PatternMatch>,
    pub signature_detections: Vec<SignatureDetection>,
    pub behavioral_patterns: Vec<BehavioralPattern>,
    pub yara_like_matches: Vec<YaraMatch>,
    pub threat_score: f64,
    pub matched_categories: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_name: String,
    pub pattern_type: String,
    pub offset: usize,
    pub length: usize,
    pub confidence: f64,
    pub context: String,
    pub severity: String,
}

#[derive(Serialize, Deserialize)]
pub struct SignatureDetection {
    pub malware_family: String,
    pub variant: Option<String>,
    pub signature_id: String,
    pub confidence: f64,
    pub description: String,
    pub references: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct BehavioralPattern {
    pub behavior: String,
    pub category: String,
    pub indicators: Vec<String>,
    pub risk_level: String,
    pub mitre_attack_ids: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct YaraMatch {
    pub rule_name: String,
    pub rule_tags: Vec<String>,
    pub matched_strings: Vec<MatchedString>,
    pub metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct MatchedString {
    pub identifier: String,
    pub offset: usize,
    pub matched_data: String,
    pub length: usize,
}

// Signature database (simplified)
struct Signature {
    id: &'static str,
    name: &'static str,
    family: &'static str,
    pattern: &'static [u8],
    description: &'static str,
}

const SIGNATURES: &[Signature] = &[
    Signature {
        id: "SIG001",
        name: "Emotet_Dropper_v1",
        family: "Emotet",
        pattern: &[0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00],
        description: "Emotet dropper variant 1",
    },
    Signature {
        id: "SIG002",
        name: "WannaCry_Ransomware",
        family: "WannaCry",
        pattern: b"WanaCrypt0r",
        description: "WannaCry ransomware signature",
    },
    Signature {
        id: "SIG003",
        name: "Cobalt_Strike_Beacon",
        family: "CobaltStrike",
        pattern: &[0x4D, 0x5A, 0x41, 0x52, 0x55, 0x48],
        description: "Cobalt Strike beacon payload",
    },
];

#[wasm_bindgen]
pub fn match_patterns(input: &str) -> String {
    let parsed_input: Result<PatternMatchInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            // Decode base64 data
            let data = match general_purpose::STANDARD.decode(&input_data.data) {
                Ok(d) => d,
                Err(_) => {
                    return create_error_result("Failed to decode base64 data");
                }
            };
            
            // Perform pattern matching
            let matches = find_pattern_matches(&data);
            let signature_detections = detect_signatures(&data);
            let behavioral_patterns = analyze_behavioral_patterns(&data);
            let yara_matches = perform_yara_like_matching(&data);
            
            let total_matches = matches.len() + signature_detections.len() + 
                               behavioral_patterns.len() + yara_matches.len();
            
            let threat_score = calculate_threat_score(&matches, &signature_detections, 
                                                    &behavioral_patterns);
            
            let matched_categories = extract_categories(&matches, &signature_detections, 
                                                       &behavioral_patterns);
            
            let result = PatternMatchResult {
                success: true,
                total_matches,
                matches,
                signature_detections,
                behavioral_patterns,
                yara_like_matches: yara_matches,
                threat_score,
                matched_categories,
            };
            
            serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            create_error_result("Failed to parse input")
        }
    }
}

fn create_error_result(error: &str) -> String {
    let result = PatternMatchResult {
        success: false,
        total_matches: 0,
        matches: vec![],
        signature_detections: vec![],
        behavioral_patterns: vec![],
        yara_like_matches: vec![],
        threat_score: 0.0,
        matched_categories: vec![error.to_string()],
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn find_pattern_matches(data: &[u8]) -> Vec<PatternMatch> {
    let mut matches = Vec::new();
    
    // Suspicious API patterns
    let api_patterns = vec![
        ("CreateRemoteThread", "Process Injection", "high"),
        ("VirtualAllocEx", "Memory Manipulation", "medium"),
        ("WriteProcessMemory", "Process Injection", "high"),
        ("SetWindowsHookEx", "Hooking", "medium"),
        ("RegSetValueEx", "Registry Modification", "medium"),
        ("WinExec", "Command Execution", "high"),
        ("ShellExecute", "Command Execution", "medium"),
        ("URLDownloadToFile", "Download Capability", "high"),
        ("InternetOpen", "Network Communication", "medium"),
        ("CreateMutex", "Mutex Creation", "low"),
        ("CryptEncrypt", "Encryption", "medium"),
        ("IsDebuggerPresent", "Anti-Debug", "medium"),
    ];
    
    for (pattern, pattern_type, severity) in api_patterns {
        if let Some(offset) = find_string_pattern(data, pattern.as_bytes()) {
            matches.push(PatternMatch {
                pattern_name: pattern.to_string(),
                pattern_type: pattern_type.to_string(),
                offset,
                length: pattern.len(),
                confidence: 0.9,
                context: extract_context(data, offset, pattern.len()),
                severity: severity.to_string(),
            });
        }
    }
    
    // Suspicious strings
    let string_patterns = vec![
        ("cmd.exe", "System Binary", "medium"),
        ("powershell", "PowerShell", "high"),
        ("bitcoin", "Cryptocurrency", "high"),
        ("wallet", "Cryptocurrency", "medium"),
        (".onion", "Tor Network", "high"),
        ("HKEY_", "Registry Key", "medium"),
        ("\\System32\\", "System Path", "low"),
        ("SELECT * FROM", "SQL Query", "medium"),
        ("eval(", "Code Execution", "high"),
        ("base64_decode", "Encoding", "medium"),
    ];
    
    for (pattern, pattern_type, severity) in string_patterns {
        if let Some(offset) = find_string_pattern(data, pattern.as_bytes()) {
            matches.push(PatternMatch {
                pattern_name: pattern.to_string(),
                pattern_type: pattern_type.to_string(),
                offset,
                length: pattern.len(),
                confidence: 0.8,
                context: extract_context(data, offset, pattern.len()),
                severity: severity.to_string(),
            });
        }
    }
    
    // Network indicators
    let _network_patterns = vec![
        (r"https?://", "URL", "medium"),
        (r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", "IP Address", "medium"),
        (r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "Email", "low"),
        (r":[0-9]{1,5}", "Port Number", "low"),
    ];
    
    // Note: In real implementation, you would use regex for these patterns
    // For now, using simple string matching for URLs
    if let Some(offset) = find_string_pattern(data, b"http://") {
        matches.push(PatternMatch {
            pattern_name: "HTTP URL".to_string(),
            pattern_type: "URL".to_string(),
            offset,
            length: 7,
            confidence: 0.9,
            context: extract_context(data, offset, 50),
            severity: "medium".to_string(),
        });
    }
    
    if let Some(offset) = find_string_pattern(data, b"https://") {
        matches.push(PatternMatch {
            pattern_name: "HTTPS URL".to_string(),
            pattern_type: "URL".to_string(),
            offset,
            length: 8,
            confidence: 0.9,
            context: extract_context(data, offset, 50),
            severity: "low".to_string(),
        });
    }
    
    matches
}

fn detect_signatures(data: &[u8]) -> Vec<SignatureDetection> {
    let mut detections = Vec::new();
    
    for sig in SIGNATURES {
        if let Some(_offset) = find_bytes_pattern(data, sig.pattern) {
            detections.push(SignatureDetection {
                malware_family: sig.family.to_string(),
                variant: Some("Unknown".to_string()),
                signature_id: sig.id.to_string(),
                confidence: 0.85,
                description: sig.description.to_string(),
                references: vec![
                    "https://malpedia.caad.fkie.fraunhofer.de".to_string(),
                ],
            });
        }
    }
    
    // Check for common packers
    let packer_sigs: Vec<(&[u8], &str, &str)> = vec![
        (b"UPX0", "UPX", "Executable packer"),
        (b"ASPack", "ASPack", "Executable packer"),
        (b".petite", "Petite", "Executable packer"),
        (b"PECompact", "PECompact", "Executable packer"),
    ];
    
    for (pattern, name, desc) in packer_sigs {
        if let Some(_offset) = find_bytes_pattern(data, pattern) {
            detections.push(SignatureDetection {
                malware_family: "Packer".to_string(),
                variant: Some(name.to_string()),
                signature_id: format!("PACK_{}", name),
                confidence: 0.95,
                description: desc.to_string(),
                references: vec![],
            });
        }
    }
    
    detections
}

fn analyze_behavioral_patterns(data: &[u8]) -> Vec<BehavioralPattern> {
    let mut patterns = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // Process injection behavior
    if text.contains("VirtualAllocEx") && text.contains("WriteProcessMemory") &&
       text.contains("CreateRemoteThread") {
        patterns.push(BehavioralPattern {
            behavior: "Process Injection".to_string(),
            category: "Defense Evasion".to_string(),
            indicators: vec![
                "VirtualAllocEx".to_string(),
                "WriteProcessMemory".to_string(),
                "CreateRemoteThread".to_string(),
            ],
            risk_level: "high".to_string(),
            mitre_attack_ids: vec!["T1055".to_string()],
        });
    }
    
    // Persistence mechanisms
    if text.contains("CurrentVersion\\Run") || text.contains("HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
        patterns.push(BehavioralPattern {
            behavior: "Registry Persistence".to_string(),
            category: "Persistence".to_string(),
            indicators: vec![
                "Registry Run Key".to_string(),
            ],
            risk_level: "medium".to_string(),
            mitre_attack_ids: vec!["T1547.001".to_string()],
        });
    }
    
    // Anti-analysis behavior
    let anti_analysis_indicators = vec![
        "IsDebuggerPresent",
        "CheckRemoteDebuggerPresent",
        "GetTickCount",
        "QueryPerformanceCounter",
        "VMware",
        "VirtualBox",
    ];
    
    let found_indicators: Vec<String> = anti_analysis_indicators.iter()
        .filter(|&&ind| text.contains(ind))
        .map(|&s| s.to_string())
        .collect();
    
    if !found_indicators.is_empty() {
        patterns.push(BehavioralPattern {
            behavior: "Anti-Analysis Techniques".to_string(),
            category: "Defense Evasion".to_string(),
            indicators: found_indicators,
            risk_level: "medium".to_string(),
            mitre_attack_ids: vec!["T1497".to_string(), "T1622".to_string()],
        });
    }
    
    // Data exfiltration
    if (text.contains("InternetOpen") || text.contains("WinHttpOpen")) &&
       (text.contains("POST") || text.contains("PUT")) {
        patterns.push(BehavioralPattern {
            behavior: "Data Exfiltration".to_string(),
            category: "Exfiltration".to_string(),
            indicators: vec![
                "HTTP Communication".to_string(),
                "POST/PUT Methods".to_string(),
            ],
            risk_level: "high".to_string(),
            mitre_attack_ids: vec!["T1041".to_string()],
        });
    }
    
    // Ransomware behavior
    if text.contains("CryptEncrypt") && 
       (text.contains(".locked") || text.contains(".encrypted") || text.contains("ransom")) {
        patterns.push(BehavioralPattern {
            behavior: "Ransomware Behavior".to_string(),
            category: "Impact".to_string(),
            indicators: vec![
                "Encryption APIs".to_string(),
                "Ransom indicators".to_string(),
            ],
            risk_level: "critical".to_string(),
            mitre_attack_ids: vec!["T1486".to_string()],
        });
    }
    
    patterns
}

fn perform_yara_like_matching(data: &[u8]) -> Vec<YaraMatch> {
    let mut matches = Vec::new();
    
    // Simulate YARA-like rules
    
    // Rule: Suspicious_Strings
    let mut suspicious_strings = Vec::new();
    let suspicious_patterns = vec![
        ("kernel32.dll", "$kernel32"),
        ("VirtualAlloc", "$valloc"),
        ("CreateThread", "$cthread"),
        ("LoadLibrary", "$loadlib"),
    ];
    
    for (pattern, identifier) in suspicious_patterns {
        if let Some(offset) = find_string_pattern(data, pattern.as_bytes()) {
            suspicious_strings.push(MatchedString {
                identifier: identifier.to_string(),
                offset,
                matched_data: pattern.to_string(),
                length: pattern.len(),
            });
        }
    }
    
    if suspicious_strings.len() >= 3 {
        matches.push(YaraMatch {
            rule_name: "Suspicious_API_Usage".to_string(),
            rule_tags: vec!["malware".to_string(), "suspicious".to_string()],
            matched_strings: suspicious_strings,
            metadata: serde_json::json!({
                "author": "Athena WASM Module",
                "description": "Detects suspicious API usage patterns",
                "severity": "medium",
            }),
        });
    }
    
    // Rule: Packed_Executable
    let entropy = calculate_entropy(data);
    if entropy > 7.0 {
        let mut packed_indicators = Vec::new();
        
        // Look for packer signatures
        let packer_strings = vec![
            ("UPX", "$upx"),
            ("ASPack", "$aspack"),
            ("PECompact", "$pecompact"),
        ];
        
        for (pattern, identifier) in packer_strings {
            if let Some(offset) = find_string_pattern(data, pattern.as_bytes()) {
                packed_indicators.push(MatchedString {
                    identifier: identifier.to_string(),
                    offset,
                    matched_data: pattern.to_string(),
                    length: pattern.len(),
                });
            }
        }
        
        matches.push(YaraMatch {
            rule_name: "Packed_Executable".to_string(),
            rule_tags: vec!["packer".to_string(), "obfuscation".to_string()],
            matched_strings: packed_indicators,
            metadata: serde_json::json!({
                "author": "Athena WASM Module",
                "description": "Detects packed executables",
                "entropy": entropy,
                "severity": "high",
            }),
        });
    }
    
    // Rule: Network_Backdoor
    let mut network_indicators = Vec::new();
    let network_patterns = vec![
        ("CONNECT", "$connect"),
        ("SOCKS", "$socks"),
        ("proxy", "$proxy"),
        ("tunnel", "$tunnel"),
        ("bind", "$bind"),
        ("listen", "$listen"),
    ];
    
    for (pattern, identifier) in network_patterns {
        if let Some(offset) = find_string_pattern(data, pattern.as_bytes()) {
            network_indicators.push(MatchedString {
                identifier: identifier.to_string(),
                offset,
                matched_data: pattern.to_string(),
                length: pattern.len(),
            });
        }
    }
    
    if network_indicators.len() >= 2 {
        matches.push(YaraMatch {
            rule_name: "Network_Backdoor".to_string(),
            rule_tags: vec!["backdoor".to_string(), "network".to_string()],
            matched_strings: network_indicators,
            metadata: serde_json::json!({
                "author": "Athena WASM Module",
                "description": "Detects potential network backdoor",
                "severity": "high",
            }),
        });
    }
    
    matches
}

fn calculate_threat_score(
    matches: &[PatternMatch],
    signatures: &[SignatureDetection],
    behaviors: &[BehavioralPattern],
) -> f64 {
    let mut score = 0.0;
    
    // Pattern matches contribution
    for pattern in matches {
        match pattern.severity.as_str() {
            "critical" => score += 20.0,
            "high" => score += 15.0,
            "medium" => score += 10.0,
            "low" => score += 5.0,
            _ => score += 2.0,
        }
    }
    
    // Signature detections contribution
    score += signatures.len() as f64 * 25.0;
    
    // Behavioral patterns contribution
    for behavior in behaviors {
        match behavior.risk_level.as_str() {
            "critical" => score += 30.0,
            "high" => score += 20.0,
            "medium" => score += 15.0,
            "low" => score += 10.0,
            _ => score += 5.0,
        }
    }
    
    // Normalize to 0-100
    (score / 10.0).min(100.0)
}

fn extract_categories(
    matches: &[PatternMatch],
    signatures: &[SignatureDetection],
    behaviors: &[BehavioralPattern],
) -> Vec<String> {
    let mut categories = std::collections::HashSet::new();
    
    for pattern in matches {
        categories.insert(pattern.pattern_type.clone());
    }
    
    for sig in signatures {
        categories.insert(sig.malware_family.clone());
    }
    
    for behavior in behaviors {
        categories.insert(behavior.category.clone());
    }
    
    let mut result: Vec<String> = categories.into_iter().collect();
    result.sort();
    result
}

fn find_string_pattern(data: &[u8], pattern: &[u8]) -> Option<usize> {
    data.windows(pattern.len())
        .position(|window| window == pattern)
}

fn find_bytes_pattern(data: &[u8], pattern: &[u8]) -> Option<usize> {
    data.windows(pattern.len())
        .position(|window| window == pattern)
}

fn extract_context(data: &[u8], offset: usize, pattern_len: usize) -> String {
    let context_before = 20;
    let context_after = 20;
    
    let start = offset.saturating_sub(context_before);
    let end = (offset + pattern_len + context_after).min(data.len());
    
    let context_bytes = &data[start..end];
    
    // Convert to string, replacing non-printable characters
    let context: String = context_bytes.iter()
        .map(|&b| {
            if b >= 32 && b <= 126 {
                b as char
            } else {
                '.'
            }
        })
        .collect();
    
    context
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

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}