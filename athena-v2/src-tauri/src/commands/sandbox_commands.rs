use tauri::command;
use crate::sandbox::{
    SandboxOrchestrator,
    SandboxConfig,
    ExecutionReport,
    OsType,
    BehaviorEvent,
    FileOperation,
    NetworkConnection,
    ProcessInfo,
    SandboxError,
    MitreAttack,
    // Volatility types
    VolatilityRunner,
    VolatilityAnalysis,
};
use std::path::PathBuf;
use std::time::Duration;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SandboxExecutionRequest {
    pub file_path: String,
    pub timeout_secs: Option<u64>,
    pub capture_network: Option<bool>,
    pub capture_screenshots: Option<bool>,
    pub memory_limit_mb: Option<u64>,
}

/// Check if the Docker sandbox is available
#[command]
pub async fn check_sandbox_available() -> Result<bool, String> {
    Ok(SandboxOrchestrator::is_docker_available().await)
}

/// Execute a sample in the sandbox with full monitoring
#[command]
pub async fn execute_sample_in_sandbox(
    file_path: String,
    timeout_secs: Option<u64>,
    capture_network: Option<bool>,
) -> Result<ExecutionReport, String> {
    // Validate file exists
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Create orchestrator
    let orchestrator = SandboxOrchestrator::new()
        .await
        .map_err(|e| format!("Failed to initialize sandbox: {}", e))?;

    // Build config
    let config = SandboxConfig {
        os_type: OsType::Linux,
        timeout: Duration::from_secs(timeout_secs.unwrap_or(120)),
        capture_network: capture_network.unwrap_or(true),
        capture_screenshots: false,
        memory_limit: 512 * 1024 * 1024, // 512MB default
    };

    // Execute
    orchestrator
        .execute_sample(path, config)
        .await
        .map_err(|e| format!("Sandbox execution failed: {}", e))
}

/// Execute a sample with custom configuration
#[command]
pub async fn execute_sample_with_config(
    request: SandboxExecutionRequest,
) -> Result<ExecutionReport, String> {
    // Validate file exists
    let path = PathBuf::from(&request.file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", request.file_path));
    }

    // Create orchestrator
    let orchestrator = SandboxOrchestrator::new()
        .await
        .map_err(|e| format!("Failed to initialize sandbox: {}", e))?;

    // Build config
    let config = SandboxConfig {
        os_type: OsType::Linux,
        timeout: Duration::from_secs(request.timeout_secs.unwrap_or(120)),
        capture_network: request.capture_network.unwrap_or(true),
        capture_screenshots: request.capture_screenshots.unwrap_or(false),
        memory_limit: request.memory_limit_mb.unwrap_or(512) * 1024 * 1024,
    };

    // Execute
    orchestrator
        .execute_sample(path, config)
        .await
        .map_err(|e| format!("Sandbox execution failed: {}", e))
}

/// Get sandbox status and capabilities
#[command]
pub async fn get_sandbox_status() -> Result<SandboxStatus, String> {
    let docker_available = SandboxOrchestrator::is_docker_available().await;

    Ok(SandboxStatus {
        docker_available,
        linux_sandbox_available: docker_available, // Would check for image
        windows_sandbox_available: false, // Not implemented yet
        max_concurrent_sandboxes: 4,
        default_timeout_secs: 120,
        default_memory_limit_mb: 512,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SandboxStatus {
    pub docker_available: bool,
    pub linux_sandbox_available: bool,
    pub windows_sandbox_available: bool,
    pub max_concurrent_sandboxes: u32,
    pub default_timeout_secs: u64,
    pub default_memory_limit_mb: u64,
}

/// Filter behavioral events by severity level
#[command]
pub fn filter_behavioral_events(
    events: Vec<BehaviorEvent>,
    severity_filter: Option<String>,
) -> Result<Vec<BehaviorEvent>, String> {
    let filtered = match severity_filter {
        Some(sev) => events
            .into_iter()
            .filter(|e| e.severity.eq_ignore_ascii_case(&sev))
            .collect(),
        None => events,
    };
    Ok(filtered)
}

/// Get summary statistics for file operations
#[command]
pub fn summarize_file_operations(
    operations: Vec<FileOperation>,
) -> Result<FileOperationSummary, String> {
    let mut creates = 0u64;
    let mut modifies = 0u64;
    let mut deletes = 0u64;
    let mut opens = 0u64;
    let mut accesses = 0u64;

    for op in &operations {
        match op.operation.to_uppercase().as_str() {
            "CREATE" => creates += 1,
            "MODIFY" => modifies += 1,
            "DELETE" => deletes += 1,
            "OPEN" => opens += 1,
            "ACCESS" => accesses += 1,
            _ => {}
        }
    }

    // Find most targeted paths
    let mut path_counts = std::collections::HashMap::<String, u64>::new();
    for op in &operations {
        *path_counts.entry(op.path.clone()).or_insert(0) += 1;
    }

    let mut paths: Vec<_> = path_counts.into_iter().collect();
    paths.sort_by(|a, b| b.1.cmp(&a.1));
    let top_paths: Vec<String> = paths.into_iter().take(10).map(|(p, _)| p).collect();

    Ok(FileOperationSummary {
        total: operations.len() as u64,
        creates,
        modifies,
        deletes,
        opens,
        accesses,
        top_paths,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationSummary {
    pub total: u64,
    pub creates: u64,
    pub modifies: u64,
    pub deletes: u64,
    pub opens: u64,
    pub accesses: u64,
    pub top_paths: Vec<String>,
}

/// Analyze network connections and group by destination
#[command]
pub fn analyze_network_connections(
    connections: Vec<NetworkConnection>,
) -> Result<NetworkAnalysisSummary, String> {
    let mut destinations = std::collections::HashMap::<String, u64>::new();
    let mut protocols = std::collections::HashMap::<String, u64>::new();
    let mut ports = std::collections::HashMap::<u16, u64>::new();

    for conn in &connections {
        *destinations.entry(conn.destination.clone()).or_insert(0) += 1;
        *protocols.entry(conn.protocol.clone()).or_insert(0) += 1;
        *ports.entry(conn.port).or_insert(0) += 1;
    }

    // Sort by frequency
    let mut dest_list: Vec<_> = destinations.into_iter().collect();
    dest_list.sort_by(|a, b| b.1.cmp(&a.1));
    let unique_destinations: Vec<String> = dest_list.into_iter().map(|(d, _)| d).collect();

    let protocol_breakdown: std::collections::HashMap<String, u64> = protocols;

    let mut port_list: Vec<_> = ports.into_iter().collect();
    port_list.sort_by(|a, b| b.1.cmp(&a.1));
    let top_ports: Vec<u16> = port_list.into_iter().take(10).map(|(p, _)| p).collect();

    Ok(NetworkAnalysisSummary {
        total_connections: connections.len() as u64,
        unique_destinations,
        protocol_breakdown,
        top_ports,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkAnalysisSummary {
    pub total_connections: u64,
    pub unique_destinations: Vec<String>,
    pub protocol_breakdown: std::collections::HashMap<String, u64>,
    pub top_ports: Vec<u16>,
}

/// Get process tree information from sandbox execution
#[command]
pub fn get_process_tree(
    processes: Vec<ProcessInfo>,
) -> Result<Vec<ProcessTreeNode>, String> {
    let mut nodes: Vec<ProcessTreeNode> = processes
        .iter()
        .map(|p| ProcessTreeNode {
            pid: p.pid,
            name: p.name.clone(),
            command_line: p.command_line.clone(),
            parent_pid: p.parent_pid,
            children: vec![],
        })
        .collect();

    // Build parent-child relationships
    // Clone PIDs first to avoid borrow issues
    let parent_child_pairs: Vec<(u32, u32)> = nodes
        .iter()
        .filter_map(|node| node.parent_pid.map(|parent| (parent, node.pid)))
        .collect();

    for (parent_pid, child_pid) in parent_child_pairs {
        if let Some(parent) = nodes.iter_mut().find(|n| n.pid == parent_pid) {
            parent.children.push(child_pid);
        }
    }

    Ok(nodes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTreeNode {
    pub pid: u32,
    pub name: String,
    pub command_line: String,
    pub parent_pid: Option<u32>,
    pub children: Vec<u32>,
}

/// Get MITRE ATT&CK technique details with recommendations
#[command]
pub fn get_mitre_attack_details(
    attacks: Vec<MitreAttack>,
) -> Result<Vec<MitreAttackDetail>, String> {
    let details: Vec<MitreAttackDetail> = attacks
        .into_iter()
        .map(|attack| {
            let recommendation = get_mitigation_for_technique(&attack.id);
            let tactic = get_tactic_for_technique(&attack.id);

            MitreAttackDetail {
                id: attack.id,
                name: attack.name,
                description: attack.description,
                confidence: attack.confidence,
                tactic,
                recommendation,
            }
        })
        .collect();

    Ok(details)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MitreAttackDetail {
    pub id: String,
    pub name: String,
    pub description: String,
    pub confidence: f64,
    pub tactic: String,
    pub recommendation: String,
}

/// Map technique ID to its tactic
fn get_tactic_for_technique(technique_id: &str) -> String {
    match technique_id {
        "T1059" => "Execution",
        "T1106" => "Execution",
        "T1071" => "Command and Control",
        "T1095" => "Command and Control",
        "T1003" => "Credential Access",
        "T1055" => "Defense Evasion, Privilege Escalation",
        "T1070" => "Defense Evasion",
        "T1222" => "Defense Evasion",
        "T1548" => "Privilege Escalation, Defense Evasion",
        "T1547" => "Persistence, Privilege Escalation",
        _ => "Unknown",
    }
    .to_string()
}

/// Get mitigation recommendations for a technique
fn get_mitigation_for_technique(technique_id: &str) -> String {
    match technique_id {
        "T1059" => "Restrict command interpreter execution, use application whitelisting",
        "T1106" => "Monitor API calls, implement behavioral analysis",
        "T1071" => "Monitor network traffic, implement network segmentation",
        "T1095" => "Block non-standard protocol traffic at network perimeter",
        "T1003" => "Implement credential guard, enable MFA, monitor LSASS access",
        "T1055" => "Use process isolation, enable protected processes",
        "T1070" => "Centralize logs in SIEM, enable audit logging",
        "T1222" => "Monitor permission changes, implement least privilege",
        "T1548" => "Disable unnecessary SUID binaries, implement UAC",
        "T1547" => "Monitor autostart locations, restrict registry access",
        _ => "Investigate behavior and implement appropriate controls",
    }
    .to_string()
}

/// Convert SandboxError to a user-friendly error message
#[command]
pub fn format_sandbox_error(error_type: String, details: String) -> Result<String, String> {
    // Use SandboxError for proper error typing
    let error = match error_type.as_str() {
        "docker_connection" => SandboxError::DockerConnection(details),
        "container_creation" => SandboxError::ContainerCreation(details),
        "file_copy" => SandboxError::FileCopy(details),
        "execution" => SandboxError::Execution(details),
        "timeout" => SandboxError::Timeout,
        "artifact_extraction" => SandboxError::ArtifactExtraction(details),
        "cleanup" => SandboxError::Cleanup(details),
        _ => return Err(format!("Unknown error type: {}", error_type)),
    };

    Ok(error.to_string())
}

/// Aggregate execution report into a threat score
#[command]
pub fn calculate_threat_score(report: ExecutionReport) -> Result<ThreatScoreResult, String> {
    let mut score: f64 = 0.0;
    let mut factors = Vec::new();

    // Score based on behavioral events
    for event in &report.behavioral_events {
        let event_score = match event.severity.as_str() {
            "Critical" => 25.0,
            "High" => 15.0,
            "Medium" => 8.0,
            "Low" => 3.0,
            _ => 1.0,
        };
        score += event_score;
        if event_score >= 15.0 {
            factors.push(format!("{}: {}", event.severity, event.description.chars().take(50).collect::<String>()));
        }
    }

    // Score based on MITRE attacks
    for attack in &report.mitre_attacks {
        let attack_score = attack.confidence * 20.0;
        score += attack_score;
        factors.push(format!("MITRE {}: {}", attack.id, attack.name));
    }

    // Score based on suspicious syscalls
    if let Some(ptrace_count) = report.syscall_summary.get("ptrace") {
        if *ptrace_count > 0 {
            score += 30.0;
            factors.push(format!("Process injection detected ({} ptrace calls)", ptrace_count));
        }
    }

    // Normalize score to 0-100
    let normalized_score = (score.min(100.0)).max(0.0);

    let risk_level = if normalized_score >= 75.0 {
        "Critical"
    } else if normalized_score >= 50.0 {
        "High"
    } else if normalized_score >= 25.0 {
        "Medium"
    } else {
        "Low"
    };

    Ok(ThreatScoreResult {
        score: normalized_score,
        risk_level: risk_level.to_string(),
        contributing_factors: factors,
        behavioral_events_count: report.behavioral_events.len(),
        mitre_attacks_count: report.mitre_attacks.len(),
        file_operations_count: report.file_operations.len(),
        network_connections_count: report.network_connections.len(),
        processes_created_count: report.processes_created.len(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatScoreResult {
    pub score: f64,
    pub risk_level: String,
    pub contributing_factors: Vec<String>,
    pub behavioral_events_count: usize,
    pub mitre_attacks_count: usize,
    pub file_operations_count: usize,
    pub network_connections_count: usize,
    pub processes_created_count: usize,
}

/// Analyze a memory dump with Volatility 3
///
/// Runs specified Volatility plugins on a memory dump to detect:
/// - Injected code (malfind)
/// - Process list and tree
/// - Network connections
/// - Loaded modules
/// - API hooks
#[command]
pub async fn analyze_memory_with_volatility(
    dump_path: String,
    plugins: Vec<String>,
) -> Result<VolatilityAnalysis, String> {
    // Validate dump file exists
    let path = PathBuf::from(&dump_path);
    if !path.exists() {
        return Err(format!("Memory dump not found: {}", dump_path));
    }

    // Create Volatility runner
    let runner = VolatilityRunner::new();

    // Check if Volatility is available
    if !runner.is_available() {
        return Err("Volatility 3 is not installed or not in PATH. Install with: pip install volatility3".to_string());
    }

    // Default plugins if none specified
    let plugins_to_run: Vec<&str> = if plugins.is_empty() {
        vec!["pslist", "malfind", "netscan"]
    } else {
        plugins.iter().map(|s| s.as_str()).collect()
    };

    // Run analysis
    runner
        .analyze_dump(&path, &plugins_to_run)
        .await
        .map_err(|e| format!("Volatility analysis failed: {}", e))
}

/// Check if Volatility 3 is available
#[command]
pub fn check_volatility_available() -> Result<VolatilityStatus, String> {
    let runner = VolatilityRunner::new();
    let available = runner.is_available();
    let version = if available {
        runner.get_version().unwrap_or_else(|_| "unknown".to_string())
    } else {
        String::new()
    };

    Ok(VolatilityStatus {
        available,
        version,
        plugins: if available {
            vec![
                "windows.pslist".to_string(),
                "windows.malfind".to_string(),
                "windows.netscan".to_string(),
                "windows.dlllist".to_string(),
                "windows.handles".to_string(),
                "linux.pslist".to_string(),
                "linux.malfind".to_string(),
            ]
        } else {
            vec![]
        },
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VolatilityStatus {
    pub available: bool,
    pub version: String,
    pub plugins: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_check_sandbox_available() {
        let result = check_sandbox_available().await;
        assert!(result.is_ok());
        // Result depends on whether Docker is running
    }

    #[tokio::test]
    async fn test_get_sandbox_status() {
        let result = get_sandbox_status().await;
        assert!(result.is_ok());
        let status = result.unwrap();
        assert_eq!(status.max_concurrent_sandboxes, 4);
    }

    #[test]
    fn test_filter_behavioral_events() {
        let events = vec![
            BehaviorEvent {
                timestamp: 1000,
                event_type: "execve".to_string(),
                description: "Process execution".to_string(),
                severity: "High".to_string(),
                mitre_attack_id: Some("T1059".to_string()),
            },
            BehaviorEvent {
                timestamp: 2000,
                event_type: "open".to_string(),
                description: "File opened".to_string(),
                severity: "Low".to_string(),
                mitre_attack_id: None,
            },
            BehaviorEvent {
                timestamp: 3000,
                event_type: "connect".to_string(),
                description: "Network connection".to_string(),
                severity: "High".to_string(),
                mitre_attack_id: Some("T1071".to_string()),
            },
        ];

        // Test filtering by severity
        let result = filter_behavioral_events(events.clone(), Some("High".to_string())).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|e| e.severity == "High"));

        // Test no filter (returns all)
        let result = filter_behavioral_events(events.clone(), None).unwrap();
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_summarize_file_operations() {
        let operations = vec![
            FileOperation { timestamp: 1000, operation: "CREATE".to_string(), path: "/tmp/file1".to_string() },
            FileOperation { timestamp: 2000, operation: "MODIFY".to_string(), path: "/tmp/file1".to_string() },
            FileOperation { timestamp: 3000, operation: "CREATE".to_string(), path: "/tmp/file2".to_string() },
            FileOperation { timestamp: 4000, operation: "DELETE".to_string(), path: "/tmp/file1".to_string() },
            FileOperation { timestamp: 5000, operation: "OPEN".to_string(), path: "/etc/passwd".to_string() },
        ];

        let result = summarize_file_operations(operations).unwrap();
        assert_eq!(result.total, 5);
        assert_eq!(result.creates, 2);
        assert_eq!(result.modifies, 1);
        assert_eq!(result.deletes, 1);
        assert_eq!(result.opens, 1);
        assert!(result.top_paths.contains(&"/tmp/file1".to_string()));
    }

    #[test]
    fn test_analyze_network_connections() {
        let connections = vec![
            NetworkConnection {
                timestamp: 1000,
                protocol: "TCP".to_string(),
                source: "192.168.1.100".to_string(),
                destination: "10.0.0.1".to_string(),
                port: 80,
                connection_type: "HTTP".to_string(),
            },
            NetworkConnection {
                timestamp: 2000,
                protocol: "TCP".to_string(),
                source: "192.168.1.100".to_string(),
                destination: "10.0.0.1".to_string(),
                port: 443,
                connection_type: "HTTPS".to_string(),
            },
            NetworkConnection {
                timestamp: 3000,
                protocol: "UDP".to_string(),
                source: "192.168.1.100".to_string(),
                destination: "8.8.8.8".to_string(),
                port: 53,
                connection_type: "DNS".to_string(),
            },
        ];

        let result = analyze_network_connections(connections).unwrap();
        assert_eq!(result.total_connections, 3);
        assert_eq!(result.unique_destinations.len(), 2);
        assert!(result.protocol_breakdown.contains_key("TCP"));
        assert!(result.protocol_breakdown.contains_key("UDP"));
        assert_eq!(*result.protocol_breakdown.get("TCP").unwrap(), 2);
    }

    #[test]
    fn test_get_process_tree() {
        let processes = vec![
            ProcessInfo {
                pid: 1,
                name: "init".to_string(),
                command_line: "/sbin/init".to_string(),
                parent_pid: None,
            },
            ProcessInfo {
                pid: 100,
                name: "bash".to_string(),
                command_line: "/bin/bash".to_string(),
                parent_pid: Some(1),
            },
            ProcessInfo {
                pid: 200,
                name: "sample".to_string(),
                command_line: "./sample.exe".to_string(),
                parent_pid: Some(100),
            },
        ];

        let result = get_process_tree(processes).unwrap();
        assert_eq!(result.len(), 3);

        let init = result.iter().find(|p| p.pid == 1).unwrap();
        assert!(init.children.contains(&100));

        let bash = result.iter().find(|p| p.pid == 100).unwrap();
        assert!(bash.children.contains(&200));
    }

    #[test]
    fn test_get_mitre_attack_details() {
        let attacks = vec![
            MitreAttack {
                id: "T1055".to_string(),
                name: "Process Injection".to_string(),
                description: "Malicious code injection detected".to_string(),
                confidence: 0.85,
            },
            MitreAttack {
                id: "T1071".to_string(),
                name: "Application Layer Protocol".to_string(),
                description: "C2 communication detected".to_string(),
                confidence: 0.72,
            },
        ];

        let result = get_mitre_attack_details(attacks).unwrap();
        assert_eq!(result.len(), 2);

        let injection = result.iter().find(|a| a.id == "T1055").unwrap();
        assert_eq!(injection.tactic, "Defense Evasion, Privilege Escalation");
        assert!(injection.recommendation.contains("process isolation"));

        let c2 = result.iter().find(|a| a.id == "T1071").unwrap();
        assert_eq!(c2.tactic, "Command and Control");
    }

    #[test]
    fn test_format_sandbox_error() {
        let result = format_sandbox_error("docker_connection".to_string(), "Connection refused".to_string()).unwrap();
        assert!(result.contains("Docker connection error"));
        assert!(result.contains("Connection refused"));

        let result = format_sandbox_error("timeout".to_string(), "".to_string()).unwrap();
        assert!(result.contains("timeout"));

        let result = format_sandbox_error("unknown_type".to_string(), "test".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_threat_score() {
        // Low threat sample
        let low_threat_report = ExecutionReport {
            session_id: "test-1".to_string(),
            exit_code: 0,
            execution_time_ms: 1000,
            behavioral_events: vec![
                BehaviorEvent {
                    timestamp: 1000,
                    event_type: "open".to_string(),
                    description: "Normal file access".to_string(),
                    severity: "Low".to_string(),
                    mitre_attack_id: None,
                },
            ],
            file_operations: vec![],
            network_connections: vec![],
            processes_created: vec![],
            syscall_summary: HashMap::new(),
            stdout: String::new(),
            stderr: String::new(),
            mitre_attacks: vec![],
            memory_dumps: vec![],
        };

        let result = calculate_threat_score(low_threat_report).unwrap();
        assert!(result.score < 25.0);
        assert_eq!(result.risk_level, "Low");

        // High threat sample
        let mut high_threat_syscalls = HashMap::new();
        high_threat_syscalls.insert("ptrace".to_string(), 5);

        let high_threat_report = ExecutionReport {
            session_id: "test-2".to_string(),
            exit_code: 0,
            execution_time_ms: 1000,
            behavioral_events: vec![
                BehaviorEvent {
                    timestamp: 1000,
                    event_type: "ptrace".to_string(),
                    description: "Process injection detected".to_string(),
                    severity: "Critical".to_string(),
                    mitre_attack_id: Some("T1055".to_string()),
                },
                BehaviorEvent {
                    timestamp: 2000,
                    event_type: "connect".to_string(),
                    description: "C2 connection".to_string(),
                    severity: "High".to_string(),
                    mitre_attack_id: Some("T1071".to_string()),
                },
            ],
            file_operations: vec![],
            network_connections: vec![],
            processes_created: vec![],
            syscall_summary: high_threat_syscalls,
            stdout: String::new(),
            stderr: String::new(),
            mitre_attacks: vec![
                MitreAttack {
                    id: "T1055".to_string(),
                    name: "Process Injection".to_string(),
                    description: "Detected".to_string(),
                    confidence: 0.9,
                },
            ],
            memory_dumps: vec![],
        };

        let result = calculate_threat_score(high_threat_report).unwrap();
        assert!(result.score >= 50.0);
        assert!(result.risk_level == "High" || result.risk_level == "Critical");
        assert!(result.contributing_factors.len() > 0);
    }
}
