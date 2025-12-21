use bollard::Docker;
use bollard::container::{Config, CreateContainerOptions, StartContainerOptions, RemoveContainerOptions, UploadToContainerOptions, DownloadFromContainerOptions};
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures::StreamExt;
use std::path::PathBuf;
use std::time::{SystemTime, Duration, UNIX_EPOCH};
use std::io::Read;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

use super::memory_capture::{MemoryDump, DumpTrigger};

/// Sandbox execution errors
#[derive(Debug)]
pub enum SandboxError {
    DockerConnection(String),
    ContainerCreation(String),
    FileCopy(String),
    Execution(String),
    Timeout,
    ArtifactExtraction(String),
    Cleanup(String),
}

impl std::fmt::Display for SandboxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SandboxError::DockerConnection(e) => write!(f, "Docker connection error: {}", e),
            SandboxError::ContainerCreation(e) => write!(f, "Container creation error: {}", e),
            SandboxError::FileCopy(e) => write!(f, "File copy error: {}", e),
            SandboxError::Execution(e) => write!(f, "Execution error: {}", e),
            SandboxError::Timeout => write!(f, "Execution timeout"),
            SandboxError::ArtifactExtraction(e) => write!(f, "Artifact extraction error: {}", e),
            SandboxError::Cleanup(e) => write!(f, "Cleanup error: {}", e),
        }
    }
}

impl std::error::Error for SandboxError {}

/// Operating system type for the sandbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OsType {
    Linux,
    Windows,
}

/// Configuration for sandbox execution
#[derive(Debug, Clone)]
pub struct SandboxConfig {
    pub os_type: OsType,
    pub timeout: Duration,
    pub capture_network: bool,
    pub capture_screenshots: bool,
    pub memory_limit: u64,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(120),
            capture_network: true,
            capture_screenshots: false,
            memory_limit: 512 * 1024 * 1024, // 512MB
        }
    }
}

/// Execution report from sandbox analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionReport {
    pub session_id: String,
    pub exit_code: i32,
    pub execution_time_ms: u64,
    pub behavioral_events: Vec<BehaviorEvent>,
    pub file_operations: Vec<FileOperation>,
    pub network_connections: Vec<NetworkConnection>,
    pub processes_created: Vec<ProcessInfo>,
    pub syscall_summary: HashMap<String, u64>,
    pub stdout: String,
    pub stderr: String,
    pub mitre_attacks: Vec<MitreAttack>,
    pub memory_dumps: Vec<MemoryDump>,
}

/// A behavioral event detected during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorEvent {
    pub timestamp: u64,
    pub event_type: String,
    pub description: String,
    pub severity: String,
    pub mitre_attack_id: Option<String>,
}

/// File operation detected during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperation {
    pub timestamp: u64,
    pub operation: String, // CREATE, MODIFY, DELETE, ACCESS, OPEN
    pub path: String,
}

/// Network connection detected during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub timestamp: u64,
    pub protocol: String,
    pub source: String,
    pub destination: String,
    pub port: u16,
    pub connection_type: String, // DNS, TCP, UDP, HTTP
}

/// Process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub command_line: String,
    pub parent_pid: Option<u32>,
}

/// MITRE ATT&CK technique mapping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MitreAttack {
    pub id: String,
    pub name: String,
    pub description: String,
    pub confidence: f64,
}

/// Main sandbox orchestrator
pub struct SandboxOrchestrator {
    docker: Docker,
}

impl SandboxOrchestrator {
    /// Create a new sandbox orchestrator
    pub async fn new() -> Result<Self, SandboxError> {
        let docker = Docker::connect_with_local_defaults()
            .map_err(|e| SandboxError::DockerConnection(format!("Failed to connect to Docker: {}. Is Docker running?", e)))?;

        // Verify Docker is accessible
        docker.ping().await
            .map_err(|e| SandboxError::DockerConnection(format!("Docker ping failed: {}. Please ensure Docker daemon is running.", e)))?;

        Ok(Self { docker })
    }

    /// Check if Docker is available
    pub async fn is_docker_available() -> bool {
        match Docker::connect_with_local_defaults() {
            Ok(docker) => docker.ping().await.is_ok(),
            Err(_) => false,
        }
    }

    /// Execute a sample in the sandbox
    pub async fn execute_sample(
        &self,
        file_path: PathBuf,
        config: SandboxConfig,
    ) -> Result<ExecutionReport, SandboxError> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let start_time = SystemTime::now();

        println!("[Sandbox] Starting session: {}", session_id);
        println!("[Sandbox] Sample: {:?}", file_path);
        println!("[Sandbox] Timeout: {:?}", config.timeout);

        // Step 1: Create sandbox container
        let container_id = self.create_sandbox_container(&config).await?;
        println!("[Sandbox] Container created: {}", container_id);

        // Ensure cleanup happens even if execution fails
        let result = self.execute_in_sandbox(&container_id, &file_path, &config).await;

        // Step 5: Cleanup container
        if let Err(e) = self.cleanup_container(&container_id).await {
            eprintln!("[Sandbox] Warning: Cleanup failed: {}", e);
        }
        println!("[Sandbox] Container cleaned up");

        let (exit_code, stdout, stderr, behavioral_events, file_operations, network_connections, processes, syscall_summary, memory_dumps) = result?;

        let execution_time_ms = start_time.elapsed()
            .unwrap_or(Duration::ZERO)
            .as_millis() as u64;

        // Map behaviors to MITRE ATT&CK
        let mitre_attacks = self.map_to_mitre_attack(&behavioral_events, &file_operations, &syscall_summary);

        Ok(ExecutionReport {
            session_id,
            exit_code,
            execution_time_ms,
            behavioral_events,
            file_operations,
            network_connections,
            processes_created: processes,
            syscall_summary,
            stdout,
            stderr,
            mitre_attacks,
            memory_dumps,
        })
    }

    async fn execute_in_sandbox(
        &self,
        container_id: &str,
        file_path: &PathBuf,
        config: &SandboxConfig,
    ) -> Result<(i32, String, String, Vec<BehaviorEvent>, Vec<FileOperation>, Vec<NetworkConnection>, Vec<ProcessInfo>, HashMap<String, u64>, Vec<MemoryDump>), SandboxError> {
        // Step 2: Copy sample to container
        self.copy_file_to_container(container_id, file_path, "/sandbox/input/sample").await?;
        println!("[Sandbox] Sample copied to container");

        // Step 3: Execute with monitoring
        let (exit_code, stdout, stderr) = self.execute_with_monitoring(
            container_id,
            "/sandbox/input/sample",
            config.timeout,
        ).await?;
        println!("[Sandbox] Execution complete: exit_code={}", exit_code);

        // Step 4: Extract and parse results
        let (behavioral_events, file_operations, network_connections, processes, syscall_summary, memory_dumps) =
            self.extract_behavioral_data(container_id).await?;
        println!("[Sandbox] Extracted {} behavioral events, {} file operations, {} memory dumps",
                 behavioral_events.len(), file_operations.len(), memory_dumps.len());

        Ok((exit_code, stdout, stderr, behavioral_events, file_operations, network_connections, processes, syscall_summary, memory_dumps))
    }

    async fn create_sandbox_container(&self, config: &SandboxConfig) -> Result<String, SandboxError> {
        let image = match config.os_type {
            OsType::Linux => "athena-sandbox:latest",
            OsType::Windows => "athena-sandbox-windows:latest",
        };

        // Create container with security restrictions
        let mut host_config = bollard::models::HostConfig::default();
        host_config.memory = Some(config.memory_limit as i64);
        host_config.memory_swap = Some(config.memory_limit as i64); // No swap
        host_config.nano_cpus = Some(1_000_000_000); // 1 CPU
        host_config.network_mode = Some("none".to_string()); // Network isolation
        host_config.readonly_rootfs = Some(false); // Need writable /sandbox/output
        host_config.security_opt = Some(vec![
            "no-new-privileges".to_string(),
        ]);
        host_config.cap_drop = Some(vec!["ALL".to_string()]);
        // Add essential capabilities for strace
        host_config.cap_add = Some(vec!["SYS_PTRACE".to_string()]);
        host_config.pids_limit = Some(256); // Limit number of processes

        let container_config = Config {
            image: Some(image.to_string()),
            host_config: Some(host_config),
            network_disabled: Some(true),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            tty: Some(false),
            ..Default::default()
        };

        let container_name = format!("athena-sandbox-{}", uuid::Uuid::new_v4());
        let options = CreateContainerOptions {
            name: container_name.clone(),
            platform: None,
        };

        let container = self.docker
            .create_container(Some(options), container_config)
            .await
            .map_err(|e| SandboxError::ContainerCreation(format!("Failed to create container: {}. Ensure 'athena-sandbox:latest' image exists.", e)))?;

        // Start container
        self.docker
            .start_container(&container.id, None::<StartContainerOptions<String>>)
            .await
            .map_err(|e| SandboxError::ContainerCreation(format!("Failed to start container: {}", e)))?;

        Ok(container.id)
    }

    async fn copy_file_to_container(
        &self,
        container_id: &str,
        host_path: &PathBuf,
        container_path: &str,
    ) -> Result<(), SandboxError> {
        // Read file from host
        let mut file = std::fs::File::open(host_path)
            .map_err(|e| SandboxError::FileCopy(format!("Failed to open file: {}", e)))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| SandboxError::FileCopy(format!("Failed to read file: {}", e)))?;

        // Create tar archive in memory
        let mut archive_builder = tar::Builder::new(Vec::new());
        let mut header = tar::Header::new_gnu();
        header.set_size(buffer.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();

        archive_builder.append_data(&mut header, "sample", &buffer[..])
            .map_err(|e| SandboxError::FileCopy(format!("Failed to create tar archive: {}", e)))?;

        let tar_data = archive_builder.into_inner()
            .map_err(|e| SandboxError::FileCopy(format!("Failed to finalize tar archive: {}", e)))?;

        // Upload to container
        let options = UploadToContainerOptions {
            path: "/sandbox/input/",
            ..Default::default()
        };

        self.docker
            .upload_to_container(container_id, Some(options), tar_data.into())
            .await
            .map_err(|e| SandboxError::FileCopy(format!("Failed to upload to container: {}", e)))?;

        Ok(())
    }

    async fn execute_with_monitoring(
        &self,
        container_id: &str,
        sample_path: &str,
        timeout: Duration,
    ) -> Result<(i32, String, String), SandboxError> {
        let timeout_str = timeout.as_secs().to_string();
        let exec_config = CreateExecOptions {
            cmd: Some(vec![
                "/usr/local/bin/monitor_agent.sh",
                sample_path,
                &timeout_str,
            ]),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };

        let exec = self.docker.create_exec(container_id, exec_config)
            .await
            .map_err(|e| SandboxError::Execution(format!("Failed to create exec: {}", e)))?;

        // Execute with timeout (add extra time for cleanup)
        let exec_result = tokio::time::timeout(
            timeout + Duration::from_secs(30),
            self.docker.start_exec(&exec.id, None),
        )
        .await
        .map_err(|_| SandboxError::Timeout)?
        .map_err(|e| SandboxError::Execution(format!("Exec failed: {}", e)))?;

        let mut stdout = String::new();
        let mut stderr = String::new();

        match exec_result {
            StartExecResults::Attached { mut output, .. } => {
                while let Some(result) = output.next().await {
                    match result {
                        Ok(log) => match &log {
                            bollard::container::LogOutput::StdOut { .. } => {
                                stdout.push_str(&String::from_utf8_lossy(&log.into_bytes()));
                            }
                            bollard::container::LogOutput::StdErr { .. } => {
                                stderr.push_str(&String::from_utf8_lossy(&log.into_bytes()));
                            }
                            _ => {}
                        },
                        Err(e) => {
                            eprintln!("[Sandbox] Error reading output: {}", e);
                        }
                    }
                }
            }
            StartExecResults::Detached => {
                return Err(SandboxError::Execution("Unexpected detached execution".to_string()));
            }
        }

        // Get exit code
        let inspect = self.docker.inspect_exec(&exec.id)
            .await
            .map_err(|e| SandboxError::Execution(format!("Failed to inspect exec: {}", e)))?;
        let exit_code = inspect.exit_code.unwrap_or(-1) as i32;

        Ok((exit_code, stdout, stderr))
    }

    async fn extract_behavioral_data(
        &self,
        container_id: &str,
    ) -> Result<(Vec<BehaviorEvent>, Vec<FileOperation>, Vec<NetworkConnection>, Vec<ProcessInfo>, HashMap<String, u64>, Vec<MemoryDump>), SandboxError> {
        // Download /sandbox/output directory
        let options = DownloadFromContainerOptions {
            path: "/sandbox/output/",
        };

        let mut stream = self.docker.download_from_container(container_id, Some(options));
        let mut archive_bytes = Vec::new();

        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(data) => archive_bytes.extend_from_slice(&data),
                Err(e) => {
                    eprintln!("[Sandbox] Warning: Error downloading artifacts: {}", e);
                    break;
                }
            }
        }

        if archive_bytes.is_empty() {
            return Ok((vec![], vec![], vec![], vec![], HashMap::new(), vec![]));
        }

        // Parse the tar archive
        let mut archive = tar::Archive::new(&archive_bytes[..]);

        let mut file_events_content = String::new();
        let mut syscalls_content = String::new();
        let mut summary_content = String::new();
        let mut stdout_content = String::new();
        let mut pcap_bytes: Vec<u8> = Vec::new();
        let mut memory_dumps: Vec<MemoryDump> = Vec::new();
        let mut dump_sizes: HashMap<String, u64> = HashMap::new();

        if let Ok(entries) = archive.entries() {
            for entry_result in entries {
                if let Ok(mut entry) = entry_result {
                    let path_result = entry.path();
                    if let Ok(path) = path_result {
                        let path_str = path.to_string_lossy().to_string();

                        if path_str.ends_with("file_events.log") {
                            let _ = entry.read_to_string(&mut file_events_content);
                        } else if path_str.ends_with("syscalls.log") {
                            let _ = entry.read_to_string(&mut syscalls_content);
                        } else if path_str.ends_with("summary.log") {
                            let _ = entry.read_to_string(&mut summary_content);
                        } else if path_str.ends_with("stdout.log") {
                            let _ = entry.read_to_string(&mut stdout_content);
                        } else if path_str.ends_with("network.pcap") {
                            // Read PCAP binary data
                            let _ = entry.read_to_end(&mut pcap_bytes);
                        } else if path_str.contains("/memory/") {
                            // Handle memory dump files
                            if let Some(filename) = path.file_name() {
                                let filename = filename.to_string_lossy().to_string();

                                // Track core dumps, region dumps, and dump files
                                if filename.starts_with("core_") || filename.starts_with("region_") || filename.starts_with("dump_") {
                                    let size = entry.header().size().unwrap_or(0);
                                    dump_sizes.insert(filename, size);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Parse file events
        let file_operations = self.parse_file_events(&file_events_content);

        // Parse syscalls
        let (behavioral_events, syscall_summary) = self.parse_syscalls(&syscalls_content);

        // Parse processes (from syscalls)
        let processes = self.extract_processes(&syscalls_content);

        // Parse network connections from PCAP
        let network_connections = if !pcap_bytes.is_empty() {
            self.parse_pcap(&pcap_bytes)
        } else {
            Vec::new()
        };

        // Build memory dump info from collected files
        for (filename, size) in dump_sizes {
            // Parse filename: core_PID_TRIGGER_TIMESTAMP or region_PID_ADDR_PERMS.bin
            let parts: Vec<&str> = filename.split('_').collect();
            if parts.len() >= 3 {
                let pid = parts[1].parse::<u32>().unwrap_or(0);
                let trigger_str = parts[2];

                let trigger = if trigger_str.starts_with("syscall") {
                    let syscall_name = trigger_str.strip_prefix("syscall_").unwrap_or("unknown");
                    DumpTrigger::SuspiciousSyscall(syscall_name.to_string())
                } else if trigger_str == "exit" {
                    DumpTrigger::ProcessExit
                } else if trigger_str == "child" {
                    DumpTrigger::ProcessStart
                } else {
                    DumpTrigger::ProcessStart
                };

                memory_dumps.push(MemoryDump {
                    pid,
                    timestamp: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or(Duration::ZERO)
                        .as_millis() as u64,
                    dump_path: PathBuf::from(format!("/sandbox/output/memory/{}", filename)),
                    trigger,
                    size_bytes: size,
                    process_name: format!("process_{}", pid),
                    command_line: String::new(),
                });
            }
        }

        println!("[Sandbox] Parsed {} memory dumps", memory_dumps.len());
        Ok((behavioral_events, file_operations, network_connections, processes, syscall_summary, memory_dumps))
    }

    fn parse_file_events(&self, content: &str) -> Vec<FileOperation> {
        let mut operations = Vec::new();

        for line in content.lines() {
            // Format: timestamp path event filename
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let timestamp = parts[0].parse::<u64>().unwrap_or(0);
                let path = parts[1].to_string();
                let event = parts[2].to_string();

                operations.push(FileOperation {
                    timestamp,
                    operation: event,
                    path,
                });
            }
        }

        operations
    }

    fn parse_syscalls(&self, content: &str) -> (Vec<BehaviorEvent>, HashMap<String, u64>) {
        let mut events = Vec::new();
        let mut syscall_counts: HashMap<String, u64> = HashMap::new();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_millis() as u64;

        for line in content.lines() {
            // Parse strace output: PID HH:MM:SS.microseconds syscall(args) = result
            if let Some(syscall_start) = line.find(char::is_alphabetic) {
                if let Some(paren_pos) = line[syscall_start..].find('(') {
                    let syscall_name = &line[syscall_start..syscall_start + paren_pos];
                    *syscall_counts.entry(syscall_name.to_string()).or_insert(0) += 1;

                    // Detect suspicious syscalls
                    let (severity, description, mitre_id) = match syscall_name {
                        "execve" => ("High", "Process execution detected", Some("T1059")),
                        "fork" | "clone" | "clone3" => ("Medium", "Process creation detected", Some("T1106")),
                        "connect" => ("High", "Network connection attempt", Some("T1071")),
                        "socket" => ("Medium", "Socket creation detected", Some("T1095")),
                        "open" | "openat" if line.contains("/etc/passwd") || line.contains("/etc/shadow") =>
                            ("Critical", "Credential file access detected", Some("T1003")),
                        "ptrace" => ("Critical", "Process injection/debugging detected", Some("T1055")),
                        "mprotect" if line.contains("PROT_EXEC") =>
                            ("High", "Memory protection change (executable)", Some("T1055")),
                        "unlink" | "unlinkat" => ("Medium", "File deletion detected", Some("T1070")),
                        "chmod" | "fchmod" => ("Medium", "Permission modification detected", Some("T1222")),
                        "setuid" | "setgid" => ("High", "Privilege change detected", Some("T1548")),
                        _ => continue,
                    };

                    events.push(BehaviorEvent {
                        timestamp: now,
                        event_type: syscall_name.to_string(),
                        description: format!("{}: {}", description, line.chars().take(200).collect::<String>()),
                        severity: severity.to_string(),
                        mitre_attack_id: mitre_id.map(|s| s.to_string()),
                    });
                }
            }
        }

        (events, syscall_counts)
    }

    fn extract_processes(&self, syscalls_content: &str) -> Vec<ProcessInfo> {
        let mut processes = Vec::new();
        let mut seen_pids = std::collections::HashSet::new();

        for line in syscalls_content.lines() {
            // Extract PID from strace output (first number in line)
            if let Some(space_pos) = line.find(' ') {
                if let Ok(pid) = line[..space_pos].parse::<u32>() {
                    if !seen_pids.contains(&pid) {
                        seen_pids.insert(pid);

                        // Try to extract command from execve calls
                        let command = if line.contains("execve(") {
                            line.chars().take(100).collect::<String>()
                        } else {
                            "unknown".to_string()
                        };

                        processes.push(ProcessInfo {
                            pid,
                            name: format!("process_{}", pid),
                            command_line: command,
                            parent_pid: None,
                        });
                    }
                }
            }
        }

        processes
    }

    /// Parse PCAP data and extract network connections
    fn parse_pcap(&self, pcap_data: &[u8]) -> Vec<NetworkConnection> {
        let mut connections = Vec::new();

        // PCAP global header is 24 bytes
        if pcap_data.len() < 24 {
            return connections;
        }

        // Check PCAP magic number
        let magic = u32::from_le_bytes([pcap_data[0], pcap_data[1], pcap_data[2], pcap_data[3]]);
        let is_le = magic == 0xa1b2c3d4 || magic == 0xa1b23c4d;
        let is_be = magic == 0xd4c3b2a1 || magic == 0x4d3cb2a1;

        if !is_le && !is_be {
            eprintln!("[Sandbox] Invalid PCAP magic number: {:08x}", magic);
            return connections;
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_millis() as u64;

        let mut offset = 24; // Skip global header
        let mut packet_count = 0;
        let max_packets = 1000; // Limit to prevent excessive parsing

        while offset + 16 <= pcap_data.len() && packet_count < max_packets {
            // Packet header: timestamp (8 bytes), captured length (4 bytes), original length (4 bytes)
            let incl_len = if is_le {
                u32::from_le_bytes([pcap_data[offset + 8], pcap_data[offset + 9], pcap_data[offset + 10], pcap_data[offset + 11]]) as usize
            } else {
                u32::from_be_bytes([pcap_data[offset + 8], pcap_data[offset + 9], pcap_data[offset + 10], pcap_data[offset + 11]]) as usize
            };

            offset += 16; // Skip packet header

            if offset + incl_len > pcap_data.len() {
                break;
            }

            // Parse the packet (assume Ethernet + IP)
            if incl_len >= 34 { // Minimum: 14 (Ethernet) + 20 (IP)
                let packet = &pcap_data[offset..offset + incl_len];

                // Check Ethernet type (bytes 12-13)
                let eth_type = u16::from_be_bytes([packet[12], packet[13]]);

                if eth_type == 0x0800 { // IPv4
                    let ip_header_start = 14;

                    if packet.len() > ip_header_start + 20 {
                        let ip_proto = packet[ip_header_start + 9];
                        let src_ip = format!("{}.{}.{}.{}",
                            packet[ip_header_start + 12],
                            packet[ip_header_start + 13],
                            packet[ip_header_start + 14],
                            packet[ip_header_start + 15]
                        );
                        let dst_ip = format!("{}.{}.{}.{}",
                            packet[ip_header_start + 16],
                            packet[ip_header_start + 17],
                            packet[ip_header_start + 18],
                            packet[ip_header_start + 19]
                        );

                        let ip_header_len = ((packet[ip_header_start] & 0x0f) * 4) as usize;
                        let transport_start = ip_header_start + ip_header_len;

                        match ip_proto {
                            6 => { // TCP
                                if packet.len() > transport_start + 4 {
                                    let src_port = u16::from_be_bytes([packet[transport_start], packet[transport_start + 1]]);
                                    let dst_port = u16::from_be_bytes([packet[transport_start + 2], packet[transport_start + 3]]);

                                    // Determine connection type by port
                                    let conn_type = match dst_port {
                                        53 => "DNS",
                                        80 | 8080 => "HTTP",
                                        443 => "HTTPS",
                                        21 => "FTP",
                                        22 => "SSH",
                                        25 | 587 => "SMTP",
                                        _ if dst_port < 1024 => "TCP",
                                        _ => "TCP",
                                    };

                                    connections.push(NetworkConnection {
                                        timestamp: now,
                                        protocol: "TCP".to_string(),
                                        source: format!("{}:{}", src_ip, src_port),
                                        destination: dst_ip.clone(),
                                        port: dst_port,
                                        connection_type: conn_type.to_string(),
                                    });
                                }
                            }
                            17 => { // UDP
                                if packet.len() > transport_start + 4 {
                                    let src_port = u16::from_be_bytes([packet[transport_start], packet[transport_start + 1]]);
                                    let dst_port = u16::from_be_bytes([packet[transport_start + 2], packet[transport_start + 3]]);

                                    let conn_type = if dst_port == 53 || src_port == 53 { "DNS" } else { "UDP" };

                                    connections.push(NetworkConnection {
                                        timestamp: now,
                                        protocol: "UDP".to_string(),
                                        source: format!("{}:{}", src_ip, src_port),
                                        destination: dst_ip.clone(),
                                        port: dst_port,
                                        connection_type: conn_type.to_string(),
                                    });
                                }
                            }
                            1 => { // ICMP
                                connections.push(NetworkConnection {
                                    timestamp: now,
                                    protocol: "ICMP".to_string(),
                                    source: src_ip,
                                    destination: dst_ip,
                                    port: 0,
                                    connection_type: "ICMP".to_string(),
                                });
                            }
                            _ => {} // Skip other protocols
                        }
                    }
                }
            }

            offset += incl_len;
            packet_count += 1;
        }

        // Deduplicate connections by destination:port
        let mut seen = std::collections::HashSet::new();
        connections.retain(|conn| {
            let key = format!("{}:{}:{}", conn.protocol, conn.destination, conn.port);
            seen.insert(key)
        });

        println!("[Sandbox] Parsed {} unique network connections from {} packets", connections.len(), packet_count);
        connections
    }

    fn map_to_mitre_attack(
        &self,
        events: &[BehaviorEvent],
        file_ops: &[FileOperation],
        syscalls: &HashMap<String, u64>,
    ) -> Vec<MitreAttack> {
        let mut attacks = Vec::new();
        let mut seen = std::collections::HashSet::new();

        // Map from behavioral events
        for event in events {
            if let Some(ref id) = event.mitre_attack_id {
                if !seen.contains(id) {
                    seen.insert(id.clone());
                    attacks.push(MitreAttack {
                        id: id.clone(),
                        name: self.get_mitre_name(id),
                        description: event.description.clone(),
                        confidence: 0.8,
                    });
                }
            }
        }

        // Check for persistence indicators
        for op in file_ops {
            if op.path.contains(".bashrc") || op.path.contains(".profile") ||
               op.path.contains("crontab") || op.path.contains("/etc/init") {
                if !seen.contains("T1547") {
                    seen.insert("T1547".to_string());
                    attacks.push(MitreAttack {
                        id: "T1547".to_string(),
                        name: "Boot or Logon Autostart Execution".to_string(),
                        description: format!("Persistence mechanism detected: {}", op.path),
                        confidence: 0.7,
                    });
                }
            }
        }

        // Check syscall patterns
        if syscalls.get("socket").unwrap_or(&0) > &0 && syscalls.get("connect").unwrap_or(&0) > &0 {
            if !seen.contains("T1071") {
                attacks.push(MitreAttack {
                    id: "T1071".to_string(),
                    name: "Application Layer Protocol".to_string(),
                    description: "Network communication detected via socket/connect syscalls".to_string(),
                    confidence: 0.6,
                });
            }
        }

        attacks
    }

    fn get_mitre_name(&self, id: &str) -> String {
        match id {
            "T1059" => "Command and Scripting Interpreter",
            "T1106" => "Native API",
            "T1071" => "Application Layer Protocol",
            "T1095" => "Non-Application Layer Protocol",
            "T1003" => "OS Credential Dumping",
            "T1055" => "Process Injection",
            "T1070" => "Indicator Removal",
            "T1222" => "File and Directory Permissions Modification",
            "T1548" => "Abuse Elevation Control Mechanism",
            "T1547" => "Boot or Logon Autostart Execution",
            _ => "Unknown Technique",
        }.to_string()
    }

    async fn cleanup_container(&self, container_id: &str) -> Result<(), SandboxError> {
        // Stop container
        let _ = self.docker
            .stop_container(container_id, None)
            .await;

        // Remove container
        let options = RemoveContainerOptions {
            force: true,
            v: true,
            ..Default::default()
        };

        self.docker
            .remove_container(container_id, Some(options))
            .await
            .map_err(|e| SandboxError::Cleanup(format!("Failed to remove container: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_docker_availability_check() {
        let available = SandboxOrchestrator::is_docker_available().await;
        // This test just verifies the function works - result depends on environment
        println!("Docker available: {}", available);
    }

    #[tokio::test]
    #[ignore] // Only run when Docker is available and image is built
    async fn test_basic_sandbox_execution() {
        let orchestrator = SandboxOrchestrator::new().await.unwrap();

        let config = SandboxConfig {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(10),
            capture_network: false,
            capture_screenshots: false,
            memory_limit: 256 * 1024 * 1024,
        };

        // Test with /bin/echo (harmless)
        let result = orchestrator
            .execute_sample(PathBuf::from("/bin/echo"), config)
            .await;

        assert!(result.is_ok(), "Sandbox execution failed: {:?}", result.err());
        let report = result.unwrap();
        println!("Report: {:?}", report);
        assert_eq!(report.exit_code, 0);
    }

    #[test]
    fn test_syscall_parsing() {
        let orchestrator_result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(SandboxOrchestrator::new());

        if let Ok(orchestrator) = orchestrator_result {
            let sample_strace = r#"1234 12:00:00.000000 execve("/bin/ls", ["ls"], 0x7fff) = 0
1234 12:00:00.001000 openat(AT_FDCWD, "/etc/passwd", O_RDONLY) = 3
1234 12:00:00.002000 socket(AF_INET, SOCK_STREAM, 0) = 4
1234 12:00:00.003000 connect(4, {sa_family=AF_INET, sin_port=htons(80)}, 16) = 0"#;

            let (events, counts) = orchestrator.parse_syscalls(sample_strace);

            assert!(events.len() > 0, "Should detect behavioral events");
            assert!(counts.get("execve").unwrap_or(&0) > &0, "Should count execve");
            assert!(counts.get("socket").unwrap_or(&0) > &0, "Should count socket");
        }
    }

    #[test]
    fn test_pcap_parsing() {
        let orchestrator_result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(SandboxOrchestrator::new());

        if let Ok(orchestrator) = orchestrator_result {
            // Construct a minimal valid PCAP with one TCP packet
            // PCAP global header (24 bytes): magic, version, timezone, sigfigs, snaplen, network
            let mut pcap_data: Vec<u8> = vec![
                0xd4, 0xc3, 0xb2, 0xa1, // Magic (little endian)
                0x02, 0x00, 0x04, 0x00, // Version 2.4
                0x00, 0x00, 0x00, 0x00, // Timezone
                0x00, 0x00, 0x00, 0x00, // Sigfigs
                0xff, 0xff, 0x00, 0x00, // Snaplen
                0x01, 0x00, 0x00, 0x00, // Network (Ethernet)
            ];

            // Packet header (16 bytes): timestamp, incl_len, orig_len
            let packet_len: u32 = 54; // Ethernet(14) + IP(20) + TCP(20)
            pcap_data.extend_from_slice(&[
                0x00, 0x00, 0x00, 0x00, // ts_sec
                0x00, 0x00, 0x00, 0x00, // ts_usec
            ]);
            pcap_data.extend_from_slice(&packet_len.to_le_bytes()); // incl_len
            pcap_data.extend_from_slice(&packet_len.to_le_bytes()); // orig_len

            // Ethernet header (14 bytes)
            pcap_data.extend_from_slice(&[0x00; 12]); // MAC addresses
            pcap_data.extend_from_slice(&[0x08, 0x00]); // IPv4 type

            // IP header (20 bytes) - TCP to 192.168.1.100:443
            pcap_data.extend_from_slice(&[
                0x45, // Version 4, IHL 5
                0x00, // DSCP
                0x00, 0x28, // Total length (40)
                0x00, 0x00, // ID
                0x00, 0x00, // Flags + Fragment
                0x40, // TTL
                0x06, // Protocol: TCP
                0x00, 0x00, // Checksum
                192, 168, 1, 1, // Source IP
                192, 168, 1, 100, // Dest IP
            ]);

            // TCP header (20 bytes) - port 12345 to port 443
            pcap_data.extend_from_slice(&[
                0x30, 0x39, // Source port: 12345
                0x01, 0xBB, // Dest port: 443
            ]);
            pcap_data.extend_from_slice(&[0x00; 16]); // Rest of TCP header

            let connections = orchestrator.parse_pcap(&pcap_data);

            assert_eq!(connections.len(), 1, "Should parse one connection");
            assert_eq!(connections[0].protocol, "TCP");
            assert_eq!(connections[0].port, 443);
            assert_eq!(connections[0].destination, "192.168.1.100");
            assert_eq!(connections[0].connection_type, "HTTPS");
        }
    }

    #[test]
    fn test_pcap_empty() {
        let orchestrator_result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(SandboxOrchestrator::new());

        if let Ok(orchestrator) = orchestrator_result {
            // Empty data should return empty connections
            let connections = orchestrator.parse_pcap(&[]);
            assert!(connections.is_empty());

            // Invalid magic should return empty connections
            let invalid_pcap = vec![0x00; 100];
            let connections = orchestrator.parse_pcap(&invalid_pcap);
            assert!(connections.is_empty());
        }
    }
}
