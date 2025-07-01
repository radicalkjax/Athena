use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct DeobfuscationInput {
    pub data: String, // Base64 encoded data
    pub length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct DeobfuscationResult {
    pub success: bool,
    pub deobfuscated_code: Option<String>,
    pub obfuscation_techniques: Vec<ObfuscationTechnique>,
    pub confidence_score: f64,
    pub ml_analysis: MlAnalysis,
    pub extracted_strings: Vec<ExtractedString>,
    pub control_flow_analysis: ControlFlowInfo,
}

#[derive(Serialize, Deserialize)]
pub struct ObfuscationTechnique {
    pub technique_name: String,
    pub severity: String, // low, medium, high
    pub locations: Vec<usize>,
    pub description: String,
}

#[derive(Serialize, Deserialize)]
pub struct MlAnalysis {
    pub malware_probability: f64,
    pub family_predictions: Vec<FamilyPrediction>,
    pub behavior_predictions: Vec<String>,
    pub packed: bool,
    pub packer_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct FamilyPrediction {
    pub family: String,
    pub confidence: f64,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedString {
    pub value: String,
    pub offset: usize,
    pub encoding: String,
    pub suspicious: bool,
    pub category: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ControlFlowInfo {
    pub has_anti_debugging: bool,
    pub has_anti_vm: bool,
    pub has_code_injection: bool,
    pub junk_code_percentage: f64,
    pub complexity_score: f64,
}

#[wasm_bindgen]
pub fn deobfuscate(input: &str) -> String {
    let parsed_input: Result<DeobfuscationInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            // Decode base64 data
            let data = match general_purpose::STANDARD.decode(&input_data.data) {
                Ok(d) => d,
                Err(_) => {
                    return serde_json::to_string(&DeobfuscationResult {
                        success: false,
                        deobfuscated_code: None,
                        obfuscation_techniques: vec![],
                        confidence_score: 0.0,
                        ml_analysis: MlAnalysis {
                            malware_probability: 0.0,
                            family_predictions: vec![],
                            behavior_predictions: vec![],
                            packed: false,
                            packer_type: None,
                        },
                        extracted_strings: vec![],
                        control_flow_analysis: ControlFlowInfo {
                            has_anti_debugging: false,
                            has_anti_vm: false,
                            has_code_injection: false,
                            junk_code_percentage: 0.0,
                            complexity_score: 0.0,
                        },
                    }).unwrap_or_else(|_| "{}".to_string());
                }
            };
            
            // Perform deobfuscation analysis
            let techniques = detect_obfuscation_techniques(&data);
            let strings = extract_strings(&data);
            let control_flow = analyze_control_flow(&data);
            let ml_analysis = perform_ml_analysis(&data, &techniques, &strings);
            let deobfuscated = attempt_deobfuscation(&data, &techniques);
            
            let result = DeobfuscationResult {
                success: deobfuscated.is_some(),
                deobfuscated_code: deobfuscated,
                obfuscation_techniques: techniques,
                confidence_score: calculate_confidence_score(&data),
                ml_analysis,
                extracted_strings: strings,
                control_flow_analysis: control_flow,
            };
            
            serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            let error_result = DeobfuscationResult {
                success: false,
                deobfuscated_code: None,
                obfuscation_techniques: vec![],
                confidence_score: 0.0,
                ml_analysis: MlAnalysis {
                    malware_probability: 0.0,
                    family_predictions: vec![],
                    behavior_predictions: vec![],
                    packed: false,
                    packer_type: None,
                },
                extracted_strings: vec![],
                control_flow_analysis: ControlFlowInfo {
                    has_anti_debugging: false,
                    has_anti_vm: false,
                    has_code_injection: false,
                    junk_code_percentage: 0.0,
                    complexity_score: 0.0,
                },
            };
            serde_json::to_string(&error_result).unwrap_or_else(|_| "{}".to_string())
        }
    }
}

fn detect_obfuscation_techniques(data: &[u8]) -> Vec<ObfuscationTechnique> {
    let mut techniques = Vec::new();
    
    // Check for string encoding/encryption
    if has_encoded_strings(data) {
        techniques.push(ObfuscationTechnique {
            technique_name: "String Encoding".to_string(),
            severity: "medium".to_string(),
            locations: find_encoded_string_locations(data),
            description: "Strings are encoded or encrypted to hide their content".to_string(),
        });
    }
    
    // Check for control flow obfuscation
    if has_control_flow_obfuscation(data) {
        techniques.push(ObfuscationTechnique {
            technique_name: "Control Flow Obfuscation".to_string(),
            severity: "high".to_string(),
            locations: vec![],
            description: "Code flow is deliberately made complex to hinder analysis".to_string(),
        });
    }
    
    // Check for dead code insertion
    if has_dead_code(data) {
        techniques.push(ObfuscationTechnique {
            technique_name: "Dead Code Insertion".to_string(),
            severity: "low".to_string(),
            locations: vec![],
            description: "Unnecessary code added to confuse analysis".to_string(),
        });
    }
    
    // Check for API obfuscation
    if has_api_obfuscation(data) {
        techniques.push(ObfuscationTechnique {
            technique_name: "API Call Obfuscation".to_string(),
            severity: "high".to_string(),
            locations: vec![],
            description: "API calls are hidden through dynamic resolution".to_string(),
        });
    }
    
    // Check for packing
    if is_packed(data) {
        techniques.push(ObfuscationTechnique {
            technique_name: "Packing".to_string(),
            severity: "high".to_string(),
            locations: vec![0],
            description: "Executable is compressed or encrypted".to_string(),
        });
    }
    
    techniques
}

fn extract_strings(data: &[u8]) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut current_string = Vec::new();
    let mut offset = 0;
    
    for (i, &byte) in data.iter().enumerate() {
        if byte >= 32 && byte <= 126 {
            if current_string.is_empty() {
                offset = i;
            }
            current_string.push(byte);
        } else if current_string.len() >= 4 {
            if let Ok(s) = String::from_utf8(current_string.clone()) {
                let suspicious = is_suspicious_string(&s);
                let category = categorize_string(&s);
                
                strings.push(ExtractedString {
                    value: s,
                    offset,
                    encoding: "ASCII".to_string(),
                    suspicious,
                    category,
                });
            }
            current_string.clear();
        } else {
            current_string.clear();
        }
    }
    
    // Also look for Unicode strings
    strings.extend(extract_unicode_strings(data));
    
    strings
}

fn analyze_control_flow(data: &[u8]) -> ControlFlowInfo {
    let anti_debug_patterns: Vec<&[u8]> = vec![
        b"IsDebuggerPresent",
        b"CheckRemoteDebuggerPresent",
        b"NtQueryInformationProcess",
        b"OutputDebugString",
    ];
    
    let anti_vm_patterns: Vec<&[u8]> = vec![
        b"VMware",
        b"VirtualBox",
        b"QEMU",
        b"Xen",
        b"vbox",
        b"vmware",
    ];
    
    let injection_patterns: Vec<&[u8]> = vec![
        b"VirtualAllocEx",
        b"WriteProcessMemory",
        b"CreateRemoteThread",
        b"SetWindowsHookEx",
    ];
    
    let has_anti_debugging = anti_debug_patterns.iter()
        .any(|pattern| contains_pattern(data, pattern));
    
    let has_anti_vm = anti_vm_patterns.iter()
        .any(|pattern| contains_pattern(data, pattern));
    
    let has_code_injection = injection_patterns.iter()
        .any(|pattern| contains_pattern(data, pattern));
    
    ControlFlowInfo {
        has_anti_debugging,
        has_anti_vm,
        has_code_injection,
        junk_code_percentage: calculate_junk_percentage(data),
        complexity_score: calculate_complexity(data),
    }
}

fn perform_ml_analysis(
    data: &[u8], 
    techniques: &[ObfuscationTechnique],
    strings: &[ExtractedString]
) -> MlAnalysis {
    // Simulate ML-based analysis
    let packed = techniques.iter().any(|t| t.technique_name == "Packing");
    let malware_probability = calculate_malware_probability(data, techniques, strings);
    
    let family_predictions = if malware_probability > 0.7 {
        vec![
            FamilyPrediction {
                family: "Emotet".to_string(),
                confidence: 0.72,
            },
            FamilyPrediction {
                family: "TrickBot".to_string(),
                confidence: 0.45,
            },
            FamilyPrediction {
                family: "QakBot".to_string(),
                confidence: 0.38,
            },
        ]
    } else {
        vec![]
    };
    
    let behavior_predictions = predict_behaviors(data, strings);
    
    MlAnalysis {
        malware_probability,
        family_predictions,
        behavior_predictions,
        packed,
        packer_type: if packed { detect_packer_type(data) } else { None },
    }
}

fn attempt_deobfuscation(data: &[u8], techniques: &[ObfuscationTechnique]) -> Option<String> {
    // Attempt basic deobfuscation
    let mut deobfuscated = data.to_vec();
    
    // Try to decode simple XOR encryption
    if let Some(key) = find_xor_key(&deobfuscated) {
        for byte in &mut deobfuscated {
            *byte ^= key;
        }
    }
    
    // Try to extract readable code
    if let Ok(result) = String::from_utf8(deobfuscated.clone()) {
        if is_readable_code(&result) {
            return Some(result);
        }
    }
    
    // If obfuscation is too complex, return None
    if techniques.len() > 3 || techniques.iter().any(|t| t.severity == "high") {
        None
    } else {
        // Return partially deobfuscated strings
        let strings: Vec<String> = extract_strings(&deobfuscated)
            .into_iter()
            .map(|s| s.value)
            .collect();
        
        if !strings.is_empty() {
            Some(strings.join("\n"))
        } else {
            None
        }
    }
}

// Helper functions
fn has_encoded_strings(data: &[u8]) -> bool {
    // Check for base64 patterns
    let b64_chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let mut b64_count = 0;
    
    for &byte in data {
        if b64_chars.contains(&byte) {
            b64_count += 1;
        }
    }
    
    b64_count as f64 / data.len() as f64 > 0.3
}

fn find_encoded_string_locations(data: &[u8]) -> Vec<usize> {
    let mut locations = Vec::new();
    let chunk_size = 64;
    
    for (i, chunk) in data.chunks(chunk_size).enumerate() {
        if has_encoded_strings(chunk) {
            locations.push(i * chunk_size);
        }
    }
    
    locations
}

fn has_control_flow_obfuscation(data: &[u8]) -> bool {
    // Look for patterns indicating obfuscated control flow
    let jmp_count = count_pattern(data, &[0xE9]); // JMP
    let call_count = count_pattern(data, &[0xE8]); // CALL
    let conditional_jmps = count_pattern(data, &[0x74, 0x75, 0x76, 0x77]); // JE, JNE, etc
    
    let total_flow_instructions = jmp_count + call_count + conditional_jmps;
    total_flow_instructions as f64 / data.len() as f64 > 0.1
}

fn has_dead_code(data: &[u8]) -> bool {
    // Look for NOP sleds and other dead code patterns
    let nop_count = count_pattern(data, &[0x90]); // NOP
    nop_count > 100
}

fn has_api_obfuscation(data: &[u8]) -> bool {
    // Check for dynamic API resolution patterns
    let patterns: Vec<&[u8]> = vec![
        b"GetProcAddress",
        b"LoadLibrary",
        b"GetModuleHandle",
    ];
    
    patterns.iter().any(|p| contains_pattern(data, p))
}

fn is_packed(data: &[u8]) -> bool {
    // Check entropy
    let entropy = calculate_entropy(data);
    entropy > 7.0
}

fn contains_pattern(data: &[u8], pattern: &[u8]) -> bool {
    data.windows(pattern.len()).any(|w| w == pattern)
}

fn count_pattern(data: &[u8], bytes: &[u8]) -> usize {
    data.iter().filter(|&&b| bytes.contains(&b)).count()
}

fn is_suspicious_string(s: &str) -> bool {
    let suspicious_patterns = vec![
        "kernel32", "ntdll", "virus", "trojan", "malware",
        "inject", "hook", "keylog", "password", "credit",
        "bitcoin", "ransom", "encrypt", "decrypt", "payload",
        "shellcode", "exploit", "backdoor", "rootkit", "dropper",
    ];
    
    let lower = s.to_lowercase();
    suspicious_patterns.iter().any(|p| lower.contains(p))
}

fn categorize_string(s: &str) -> Option<String> {
    let lower = s.to_lowercase();
    
    if lower.contains("http://") || lower.contains("https://") {
        Some("URL".to_string())
    } else if lower.contains('@') && lower.contains('.') {
        Some("Email".to_string())
    } else if lower.ends_with(".dll") || lower.ends_with(".exe") {
        Some("File".to_string())
    } else if lower.contains("hkey_") || lower.contains("software\\") {
        Some("Registry".to_string())
    } else if is_suspicious_string(s) {
        Some("Suspicious".to_string())
    } else {
        None
    }
}

fn extract_unicode_strings(data: &[u8]) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut i = 0;
    
    while i < data.len() - 1 {
        if data[i] != 0 && data[i + 1] == 0 {
            let mut unicode_bytes = Vec::new();
            let offset = i;
            
            while i < data.len() - 1 && data[i] != 0 {
                unicode_bytes.push(data[i]);
                i += 2;
            }
            
            if unicode_bytes.len() >= 4 {
                if let Ok(s) = String::from_utf8(unicode_bytes) {
                    strings.push(ExtractedString {
                        value: s.clone(),
                        offset,
                        encoding: "UTF-16LE".to_string(),
                        suspicious: is_suspicious_string(&s),
                        category: categorize_string(&s),
                    });
                }
            }
        }
        i += 1;
    }
    
    strings
}

fn calculate_junk_percentage(data: &[u8]) -> f64 {
    let nop_count = data.iter().filter(|&&b| b == 0x90).count();
    let zero_count = data.iter().filter(|&&b| b == 0x00).count();
    let junk_count = nop_count + zero_count;
    
    (junk_count as f64 / data.len() as f64) * 100.0
}

fn calculate_complexity(data: &[u8]) -> f64 {
    // Simple complexity metric based on instruction diversity
    let mut unique_bytes = std::collections::HashSet::new();
    for &byte in data {
        unique_bytes.insert(byte);
    }
    
    unique_bytes.len() as f64 / 256.0
}

fn calculate_malware_probability(
    data: &[u8],
    techniques: &[ObfuscationTechnique],
    strings: &[ExtractedString]
) -> f64 {
    let mut score = 0.0;
    
    // Factor in obfuscation techniques
    score += techniques.len() as f64 * 0.1;
    for tech in techniques {
        match tech.severity.as_str() {
            "high" => score += 0.2,
            "medium" => score += 0.1,
            "low" => score += 0.05,
            _ => {}
        }
    }
    
    // Factor in suspicious strings
    let suspicious_count = strings.iter().filter(|s| s.suspicious).count();
    score += (suspicious_count as f64 * 0.05).min(0.3);
    
    // Factor in entropy
    let entropy = calculate_entropy(data);
    if entropy > 7.0 {
        score += 0.2;
    }
    
    score.min(1.0)
}

fn predict_behaviors(data: &[u8], strings: &[ExtractedString]) -> Vec<String> {
    let mut behaviors = Vec::new();
    
    // Check strings for behavior indicators
    for s in strings {
        let lower = s.value.to_lowercase();
        
        if lower.contains("bank") || lower.contains("credit") || lower.contains("paypal") {
            behaviors.push("Banking Trojan".to_string());
        }
        if lower.contains("keylog") || lower.contains("keyboard") {
            behaviors.push("Keylogger".to_string());
        }
        if lower.contains("screenshot") || lower.contains("screen") {
            behaviors.push("Screen Capture".to_string());
        }
        if lower.contains("ransom") || lower.contains("encrypt") {
            behaviors.push("Ransomware".to_string());
        }
    }
    
    // Check for network indicators
    if strings.iter().any(|s| s.category == Some("URL".to_string())) {
        behaviors.push("Network Communication".to_string());
    }
    
    // Check for persistence indicators
    if contains_pattern(data, b"CurrentVersion\\Run") {
        behaviors.push("Persistence".to_string());
    }
    
    behaviors.sort();
    behaviors.dedup();
    behaviors
}

fn detect_packer_type(data: &[u8]) -> Option<String> {
    // Check for common packer signatures
    let packers: Vec<(&[u8], &str)> = vec![
        (b"UPX0", "UPX"),
        (b"ASPack", "ASPack"),
        (b"PECompact", "PECompact"),
        (b"Themida", "Themida"),
        (b"VMProtect", "VMProtect"),
        (b"Obsidium", "Obsidium"),
    ];
    
    for (signature, name) in packers {
        if contains_pattern(data, signature) {
            return Some(name.to_string());
        }
    }
    
    None
}

fn find_xor_key(data: &[u8]) -> Option<u8> {
    // Try common XOR keys
    let common_keys = vec![0x00, 0xFF, 0xAA, 0x55, 0x13, 0x37, 0x42];
    
    for &key in &common_keys {
        if key == 0 {
            continue;
        }
        
        let mut test = vec![0u8; data.len().min(256)];
        for (i, &byte) in data.iter().take(test.len()).enumerate() {
            test[i] = byte ^ key;
        }
        
        // Check if result looks like readable text
        let readable_count = test.iter()
            .filter(|&&b| (b >= 32 && b <= 126) || b == 10 || b == 13)
            .count();
        
        if readable_count as f64 / test.len() as f64 > 0.8 {
            return Some(key);
        }
    }
    
    None
}

fn is_readable_code(s: &str) -> bool {
    // Check if string contains code-like patterns
    let code_indicators = vec![
        "function", "var", "let", "const", "if", "else", "for", "while",
        "return", "class", "import", "export", "def", "int", "void",
        "public", "private", "static", "#include", "using", "namespace",
    ];
    
    let count = code_indicators.iter()
        .filter(|&indicator| s.contains(indicator))
        .count();
    
    count >= 3
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

fn calculate_confidence_score(data: &[u8]) -> f64 {
    // Calculate confidence based on data quality and size
    let size_factor = (data.len() as f64 / 1024.0).min(1.0);
    let entropy = calculate_entropy(data);
    let entropy_factor = if entropy > 3.0 && entropy < 8.0 { 1.0 } else { 0.5 };
    
    (size_factor * 0.5 + entropy_factor * 0.5).min(1.0)
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}