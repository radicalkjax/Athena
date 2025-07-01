use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct SandboxInput {
    pub data: String, // Base64 encoded data
    pub length: usize,
    pub execution_time_limit: Option<u32>, // in seconds
    pub memory_limit: Option<u32>, // in MB
}

#[derive(Serialize, Deserialize)]
pub struct SandboxConfig {
    pub sandbox_id: String,
    pub sandbox_type: String,
    pub isolation_level: String,
    pub permissions: Vec<String>,
    pub resource_limits: ResourceLimits,
    pub monitoring_enabled: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: u32,
    pub max_cpu_percent: u32,
    pub max_execution_time_seconds: u32,
    pub max_file_size_mb: u32,
    pub max_network_connections: u32,
}

#[derive(Serialize, Deserialize)]
pub struct SandboxResult {
    pub success: bool,
    pub sandbox_config: SandboxConfig,
    pub execution_summary: ExecutionSummary,
    pub behavioral_analysis: BehavioralAnalysis,
    pub system_changes: SystemChanges,
    pub network_activity: NetworkActivity,
    pub threat_indicators: Vec<ThreatIndicator>,
    pub sandbox_verdict: SandboxVerdict,
}

#[derive(Serialize, Deserialize)]
pub struct ExecutionSummary {
    pub execution_time_ms: u64,
    pub exit_code: Option<i32>,
    pub crashed: bool,
    pub timeout_reached: bool,
    pub memory_peak_mb: u32,
    pub cpu_usage_percent: f32,
}

#[derive(Serialize, Deserialize)]
pub struct BehavioralAnalysis {
    pub process_tree: Vec<ProcessInfo>,
    pub api_calls: Vec<ApiCall>,
    pub suspicious_behaviors: Vec<SuspiciousBehavior>,
    pub evasion_techniques: Vec<EvasionTechnique>,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: u32,
    pub process_name: String,
    pub command_line: String,
    pub creation_time: u64,
    pub termination_time: Option<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiCall {
    pub timestamp: u64,
    pub process_id: u32,
    pub api_name: String,
    pub category: String,
    pub parameters: Vec<String>,
    pub return_value: String,
    pub suspicious: bool,
}

#[derive(Serialize, Deserialize)]
pub struct SuspiciousBehavior {
    pub behavior_type: String,
    pub description: String,
    pub severity: String,
    pub evidence: Vec<String>,
    pub mitre_tactics: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct EvasionTechnique {
    pub technique: String,
    pub description: String,
    pub detected_at: u64,
    pub confidence: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SystemChanges {
    pub file_operations: Vec<FileOperation>,
    pub registry_operations: Vec<RegistryOperation>,
    pub service_operations: Vec<ServiceOperation>,
    pub persistence_mechanisms: Vec<PersistenceMechanism>,
}

#[derive(Serialize, Deserialize)]
pub struct FileOperation {
    pub operation_type: String,
    pub file_path: String,
    pub process_id: u32,
    pub timestamp: u64,
    pub success: bool,
    pub suspicious: bool,
}

#[derive(Serialize, Deserialize)]
pub struct RegistryOperation {
    pub operation_type: String,
    pub key_path: String,
    pub value_name: Option<String>,
    pub value_data: Option<String>,
    pub process_id: u32,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ServiceOperation {
    pub operation_type: String,
    pub service_name: String,
    pub display_name: Option<String>,
    pub binary_path: Option<String>,
    pub process_id: u32,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct PersistenceMechanism {
    pub mechanism_type: String,
    pub location: String,
    pub details: String,
    pub severity: String,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkActivity {
    pub connections: Vec<NetworkConnection>,
    pub dns_queries: Vec<DnsQuery>,
    pub http_requests: Vec<HttpRequest>,
    pub data_transfers: Vec<DataTransfer>,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkConnection {
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub state: String,
    pub process_id: u32,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct DnsQuery {
    pub query_type: String,
    pub domain: String,
    pub resolved_ips: Vec<String>,
    pub process_id: u32,
    pub timestamp: u64,
    pub suspicious: bool,
}

#[derive(Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body_size: usize,
    pub response_code: Option<u16>,
    pub process_id: u32,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct DataTransfer {
    pub direction: String,
    pub protocol: String,
    pub bytes_transferred: u64,
    pub remote_address: String,
    pub process_id: u32,
    pub duration_ms: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub indicator_type: String,
    pub value: String,
    pub context: String,
    pub severity: String,
    pub confidence: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SandboxVerdict {
    pub malicious: bool,
    pub threat_score: f64,
    pub threat_categories: Vec<String>,
    pub recommended_actions: Vec<String>,
    pub detailed_analysis: String,
}

#[wasm_bindgen]
pub fn create_sandbox(input: &str) -> String {
    let parsed_input: Result<SandboxInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            let sandbox_config = SandboxConfig {
                sandbox_id: generate_sandbox_id(),
                sandbox_type: "WASM-Isolated".to_string(),
                isolation_level: "High".to_string(),
                permissions: vec![
                    "FileRead".to_string(),
                    "NetworkMonitor".to_string(),
                    "ProcessMonitor".to_string(),
                ],
                resource_limits: ResourceLimits {
                    max_memory_mb: input_data.memory_limit.unwrap_or(512),
                    max_cpu_percent: 50,
                    max_execution_time_seconds: input_data.execution_time_limit.unwrap_or(300),
                    max_file_size_mb: 100,
                    max_network_connections: 10,
                },
                monitoring_enabled: true,
            };
            
            serde_json::to_string(&sandbox_config).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            create_error_config()
        }
    }
}

#[wasm_bindgen]
pub fn execute_in_sandbox(input: &str) -> String {
    let parsed_input: Result<SandboxInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            // Decode base64 data
            let data = match general_purpose::STANDARD.decode(&input_data.data) {
                Ok(d) => d,
                Err(_) => {
                    return create_error_result("Failed to decode base64 data");
                }
            };
            
            // Create sandbox configuration
            let sandbox_config = SandboxConfig {
                sandbox_id: generate_sandbox_id(),
                sandbox_type: "WASM-Isolated".to_string(),
                isolation_level: "High".to_string(),
                permissions: vec![
                    "FileRead".to_string(),
                    "NetworkMonitor".to_string(),
                    "ProcessMonitor".to_string(),
                ],
                resource_limits: ResourceLimits {
                    max_memory_mb: input_data.memory_limit.unwrap_or(512),
                    max_cpu_percent: 50,
                    max_execution_time_seconds: input_data.execution_time_limit.unwrap_or(300),
                    max_file_size_mb: 100,
                    max_network_connections: 10,
                },
                monitoring_enabled: true,
            };
            
            // Simulate sandbox execution
            let execution_summary = simulate_execution(&data);
            let behavioral_analysis = analyze_behavior(&data);
            let system_changes = detect_system_changes(&data);
            let network_activity = monitor_network_activity(&data);
            let threat_indicators = extract_threat_indicators(&data, &behavioral_analysis);
            
            let threat_score = calculate_threat_score(&behavioral_analysis, &system_changes, 
                                                    &network_activity, &threat_indicators);
            
            let sandbox_verdict = generate_verdict(threat_score, &threat_indicators, 
                                                  &behavioral_analysis);
            
            let result = SandboxResult {
                success: true,
                sandbox_config,
                execution_summary,
                behavioral_analysis,
                system_changes,
                network_activity,
                threat_indicators,
                sandbox_verdict,
            };
            
            serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            create_error_result("Failed to parse input")
        }
    }
}

fn create_error_config() -> String {
    let config = SandboxConfig {
        sandbox_id: "error".to_string(),
        sandbox_type: "None".to_string(),
        isolation_level: "None".to_string(),
        permissions: vec![],
        resource_limits: ResourceLimits {
            max_memory_mb: 0,
            max_cpu_percent: 0,
            max_execution_time_seconds: 0,
            max_file_size_mb: 0,
            max_network_connections: 0,
        },
        monitoring_enabled: false,
    };
    
    serde_json::to_string(&config).unwrap_or_else(|_| "{}".to_string())
}

fn create_error_result(error: &str) -> String {
    let result = SandboxResult {
        success: false,
        sandbox_config: SandboxConfig {
            sandbox_id: "error".to_string(),
            sandbox_type: "None".to_string(),
            isolation_level: "None".to_string(),
            permissions: vec![],
            resource_limits: ResourceLimits {
                max_memory_mb: 0,
                max_cpu_percent: 0,
                max_execution_time_seconds: 0,
                max_file_size_mb: 0,
                max_network_connections: 0,
            },
            monitoring_enabled: false,
        },
        execution_summary: ExecutionSummary {
            execution_time_ms: 0,
            exit_code: None,
            crashed: false,
            timeout_reached: false,
            memory_peak_mb: 0,
            cpu_usage_percent: 0.0,
        },
        behavioral_analysis: BehavioralAnalysis {
            process_tree: vec![],
            api_calls: vec![],
            suspicious_behaviors: vec![],
            evasion_techniques: vec![],
        },
        system_changes: SystemChanges {
            file_operations: vec![],
            registry_operations: vec![],
            service_operations: vec![],
            persistence_mechanisms: vec![],
        },
        network_activity: NetworkActivity {
            connections: vec![],
            dns_queries: vec![],
            http_requests: vec![],
            data_transfers: vec![],
        },
        threat_indicators: vec![],
        sandbox_verdict: SandboxVerdict {
            malicious: false,
            threat_score: 0.0,
            threat_categories: vec![error.to_string()],
            recommended_actions: vec![],
            detailed_analysis: error.to_string(),
        },
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn generate_sandbox_id() -> String {
    format!("sandbox_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis())
}

fn simulate_execution(data: &[u8]) -> ExecutionSummary {
    // Simulate execution metrics
    let execution_time_ms = 5000 + (data.len() as u64 % 10000);
    let memory_usage = 50 + (data.len() as u32 / 1024).min(400);
    
    // Check for crash indicators
    let crashed = data.windows(4).any(|w| w == b"\x00\x00\x00\x00");
    
    ExecutionSummary {
        execution_time_ms,
        exit_code: if crashed { Some(-1) } else { Some(0) },
        crashed,
        timeout_reached: false,
        memory_peak_mb: memory_usage,
        cpu_usage_percent: 25.5,
    }
}

fn analyze_behavior(data: &[u8]) -> BehavioralAnalysis {
    let mut process_tree = vec![];
    let mut api_calls = vec![];
    let mut suspicious_behaviors = vec![];
    let mut evasion_techniques = vec![];
    
    // Simulate process creation
    process_tree.push(ProcessInfo {
        pid: 1000,
        parent_pid: 1,
        process_name: "sample.exe".to_string(),
        command_line: "sample.exe".to_string(),
        creation_time: 0,
        termination_time: None,
    });
    
    // Detect API calls
    let api_patterns = vec![
        ("VirtualAlloc", "Memory", true),
        ("CreateThread", "Process", true),
        ("GetProcAddress", "System", false),
        ("RegSetValue", "Registry", true),
        ("InternetOpen", "Network", true),
        ("CreateFile", "FileSystem", false),
    ];
    
    let text = String::from_utf8_lossy(data);
    for (api, category, suspicious) in api_patterns {
        if text.contains(api) {
            api_calls.push(ApiCall {
                timestamp: api_calls.len() as u64 * 1000,
                process_id: 1000,
                api_name: api.to_string(),
                category: category.to_string(),
                parameters: vec!["<parameters>".to_string()],
                return_value: "0x00000000".to_string(),
                suspicious,
            });
        }
    }
    
    // Detect suspicious behaviors
    if text.contains("VirtualAlloc") && text.contains("CreateThread") {
        suspicious_behaviors.push(SuspiciousBehavior {
            behavior_type: "Code Injection".to_string(),
            description: "Process appears to inject code into memory".to_string(),
            severity: "high".to_string(),
            evidence: vec![
                "VirtualAlloc API call".to_string(),
                "CreateThread API call".to_string(),
            ],
            mitre_tactics: vec!["T1055".to_string()],
        });
    }
    
    // Detect evasion techniques
    if text.contains("IsDebuggerPresent") {
        evasion_techniques.push(EvasionTechnique {
            technique: "Anti-Debugging".to_string(),
            description: "Checks for debugger presence".to_string(),
            detected_at: 1000,
            confidence: 0.9,
        });
    }
    
    if text.contains("Sleep") && text.contains("GetTickCount") {
        evasion_techniques.push(EvasionTechnique {
            technique: "Timing Analysis".to_string(),
            description: "Uses timing checks to detect analysis".to_string(),
            detected_at: 2000,
            confidence: 0.7,
        });
    }
    
    BehavioralAnalysis {
        process_tree,
        api_calls,
        suspicious_behaviors,
        evasion_techniques,
    }
}

fn detect_system_changes(data: &[u8]) -> SystemChanges {
    let mut file_operations = vec![];
    let mut registry_operations = vec![];
    let mut service_operations = vec![];
    let mut persistence_mechanisms = vec![];
    
    let text = String::from_utf8_lossy(data);
    
    // Detect file operations
    if text.contains("CreateFile") || text.contains("WriteFile") {
        file_operations.push(FileOperation {
            operation_type: "Create".to_string(),
            file_path: "C:\\Windows\\Temp\\malware.exe".to_string(),
            process_id: 1000,
            timestamp: 1000,
            success: true,
            suspicious: true,
        });
    }
    
    // Detect registry operations
    if text.contains("RegSetValue") || text.contains("CurrentVersion\\Run") {
        registry_operations.push(RegistryOperation {
            operation_type: "SetValue".to_string(),
            key_path: "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run".to_string(),
            value_name: Some("Malware".to_string()),
            value_data: Some("C:\\malware.exe".to_string()),
            process_id: 1000,
            timestamp: 2000,
        });
        
        persistence_mechanisms.push(PersistenceMechanism {
            mechanism_type: "Registry Run Key".to_string(),
            location: "HKLM\\...\\CurrentVersion\\Run".to_string(),
            details: "Adds malware to startup".to_string(),
            severity: "high".to_string(),
        });
    }
    
    // Detect service operations
    if text.contains("CreateService") || text.contains("StartService") {
        service_operations.push(ServiceOperation {
            operation_type: "Create".to_string(),
            service_name: "MalwareService".to_string(),
            display_name: Some("Malware Service".to_string()),
            binary_path: Some("C:\\malware.exe".to_string()),
            process_id: 1000,
            timestamp: 3000,
        });
        
        persistence_mechanisms.push(PersistenceMechanism {
            mechanism_type: "Windows Service".to_string(),
            location: "Services".to_string(),
            details: "Creates malicious service".to_string(),
            severity: "high".to_string(),
        });
    }
    
    SystemChanges {
        file_operations,
        registry_operations,
        service_operations,
        persistence_mechanisms,
    }
}

fn monitor_network_activity(data: &[u8]) -> NetworkActivity {
    let mut connections = vec![];
    let mut dns_queries = vec![];
    let mut http_requests = vec![];
    let mut data_transfers = vec![];
    
    let text = String::from_utf8_lossy(data);
    
    // Detect network connections
    if text.contains("connect") || text.contains("socket") {
        connections.push(NetworkConnection {
            protocol: "TCP".to_string(),
            local_address: "192.168.1.100".to_string(),
            local_port: 49152,
            remote_address: "185.45.192.100".to_string(),
            remote_port: 443,
            state: "ESTABLISHED".to_string(),
            process_id: 1000,
            timestamp: 1000,
        });
    }
    
    // Detect DNS queries
    if text.contains("gethostbyname") || text.contains("getaddrinfo") {
        dns_queries.push(DnsQuery {
            query_type: "A".to_string(),
            domain: "malicious-c2.com".to_string(),
            resolved_ips: vec!["185.45.192.100".to_string()],
            process_id: 1000,
            timestamp: 500,
            suspicious: true,
        });
    }
    
    // Detect HTTP requests
    if text.contains("POST") || text.contains("GET") {
        http_requests.push(HttpRequest {
            method: "POST".to_string(),
            url: "https://malicious-c2.com/gate.php".to_string(),
            headers: vec![
                ("User-Agent".to_string(), "Mozilla/5.0".to_string()),
                ("Content-Type".to_string(), "application/json".to_string()),
            ],
            body_size: 1024,
            response_code: Some(200),
            process_id: 1000,
            timestamp: 2000,
        });
        
        data_transfers.push(DataTransfer {
            direction: "Outbound".to_string(),
            protocol: "HTTPS".to_string(),
            bytes_transferred: 1024,
            remote_address: "185.45.192.100".to_string(),
            process_id: 1000,
            duration_ms: 150,
        });
    }
    
    NetworkActivity {
        connections,
        dns_queries,
        http_requests,
        data_transfers,
    }
}

fn extract_threat_indicators(
    data: &[u8], 
    behavioral_analysis: &BehavioralAnalysis
) -> Vec<ThreatIndicator> {
    let mut indicators = vec![];
    
    // Add behavior-based indicators
    for behavior in &behavioral_analysis.suspicious_behaviors {
        indicators.push(ThreatIndicator {
            indicator_type: "Behavior".to_string(),
            value: behavior.behavior_type.clone(),
            context: behavior.description.clone(),
            severity: behavior.severity.clone(),
            confidence: 0.8,
        });
    }
    
    // Add evasion technique indicators
    for evasion in &behavioral_analysis.evasion_techniques {
        indicators.push(ThreatIndicator {
            indicator_type: "Evasion".to_string(),
            value: evasion.technique.clone(),
            context: evasion.description.clone(),
            severity: "medium".to_string(),
            confidence: evasion.confidence,
        });
    }
    
    // Add string-based indicators
    let text = String::from_utf8_lossy(data);
    let malicious_strings = vec![
        ("ransomware", "Ransomware indicator"),
        ("encrypt", "Encryption capability"),
        ("bitcoin", "Cryptocurrency reference"),
        ("tor", "Tor network usage"),
    ];
    
    for (pattern, context) in malicious_strings {
        if text.to_lowercase().contains(pattern) {
            indicators.push(ThreatIndicator {
                indicator_type: "String".to_string(),
                value: pattern.to_string(),
                context: context.to_string(),
                severity: "high".to_string(),
                confidence: 0.7,
            });
        }
    }
    
    indicators
}

fn calculate_threat_score(
    behavioral_analysis: &BehavioralAnalysis,
    system_changes: &SystemChanges,
    network_activity: &NetworkActivity,
    threat_indicators: &[ThreatIndicator],
) -> f64 {
    let mut score = 0.0;
    
    // Behavioral score
    score += behavioral_analysis.suspicious_behaviors.len() as f64 * 15.0;
    score += behavioral_analysis.evasion_techniques.len() as f64 * 10.0;
    
    // System changes score
    score += system_changes.persistence_mechanisms.len() as f64 * 20.0;
    score += system_changes.registry_operations.len() as f64 * 5.0;
    
    // Network activity score
    score += network_activity.connections.len() as f64 * 5.0;
    score += network_activity.http_requests.len() as f64 * 10.0;
    
    // Threat indicators score
    for indicator in threat_indicators {
        match indicator.severity.as_str() {
            "critical" => score += 25.0,
            "high" => score += 15.0,
            "medium" => score += 10.0,
            "low" => score += 5.0,
            _ => score += 2.0,
        }
    }
    
    score.min(100.0)
}

fn generate_verdict(
    threat_score: f64,
    threat_indicators: &[ThreatIndicator],
    behavioral_analysis: &BehavioralAnalysis,
) -> SandboxVerdict {
    let malicious = threat_score > 50.0;
    
    let mut threat_categories = vec![];
    if behavioral_analysis.suspicious_behaviors.iter()
        .any(|b| b.behavior_type.contains("Injection")) {
        threat_categories.push("Code Injection".to_string());
    }
    if behavioral_analysis.evasion_techniques.len() > 0 {
        threat_categories.push("Evasive Malware".to_string());
    }
    if threat_indicators.iter().any(|i| i.value.contains("ransom")) {
        threat_categories.push("Ransomware".to_string());
    }
    
    let mut recommended_actions = vec![];
    if malicious {
        recommended_actions.push("Quarantine the file immediately".to_string());
        recommended_actions.push("Block all network connections".to_string());
        recommended_actions.push("Scan system for related threats".to_string());
    } else if threat_score > 30.0 {
        recommended_actions.push("Monitor file behavior closely".to_string());
        recommended_actions.push("Restrict network access".to_string());
    }
    
    let detailed_analysis = format!(
        "Sandbox analysis completed. Found {} suspicious behaviors, {} evasion techniques, \
         and {} threat indicators. The sample shows {} threat level with a confidence of {:.1}%.",
        behavioral_analysis.suspicious_behaviors.len(),
        behavioral_analysis.evasion_techniques.len(),
        threat_indicators.len(),
        if malicious { "HIGH" } else if threat_score > 30.0 { "MEDIUM" } else { "LOW" },
        threat_score
    );
    
    SandboxVerdict {
        malicious,
        threat_score,
        threat_categories,
        recommended_actions,
        detailed_analysis,
    }
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}