use bollard::Docker;
use bollard::container::{Config, CreateContainerOptions, StartContainerOptions, RemoveContainerOptions, UploadToContainerOptions, DownloadFromContainerOptions};
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures::StreamExt;
use std::path::PathBuf;
use std::time::{SystemTime, Duration, UNIX_EPOCH};
use std::io::Read;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

use super::memory_capture::{MemoryDump, DumpTrigger, MemoryCaptureConfig, MemoryCaptureManager};
use super::anti_evasion::AntiEvasionManager;
use super::video_capture::{VideoCaptureConfig, VideoRecording, VideoCaptureManager};

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
    /// Enable network traffic capture (creates network.pcap)
    pub capture_network: bool,
    pub memory_limit: u64,
    /// Anti-evasion tier: None = disabled, Some(1) = tier1, Some(2) = tier2
    pub anti_evasion_tier: Option<u8>,
    /// Memory capture configuration
    pub memory_capture_config: Option<MemoryCaptureConfig>,
    /// Enable video recording of execution
    pub capture_video: bool,
    /// Video capture configuration (if enabled)
    pub video_config: Option<VideoCaptureConfig>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(120),
            capture_network: true,
            memory_limit: 512 * 1024 * 1024, // 512MB
            anti_evasion_tier: None, // Disabled by default
            memory_capture_config: None,
            capture_video: false, // Disabled by default
            video_config: None,
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
    /// Video recording of execution (if video capture was enabled)
    pub video_recording: Option<VideoRecording>,
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

        let container_id = self.create_sandbox_container(&config).await?;
        println!("[Sandbox] Container created: {}", container_id);

        let result = self.execute_in_sandbox(&container_id, &file_path, &config).await;

        // Always cleanup container, even on failure
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
            video_recording: None, // Will be set by execute_in_sandbox if video capture is enabled
        })
    }

    async fn execute_in_sandbox(
        &self,
        container_id: &str,
        file_path: &PathBuf,
        config: &SandboxConfig,
    ) -> Result<(i32, String, String, Vec<BehaviorEvent>, Vec<FileOperation>, Vec<NetworkConnection>, Vec<ProcessInfo>, HashMap<String, u64>, Vec<MemoryDump>), SandboxError> {
        self.copy_file_to_container(container_id, file_path, "/sandbox/input/sample").await?;
        println!("[Sandbox] Sample copied to container");

        let (exit_code, stdout, stderr) = self.execute_with_monitoring(
            container_id,
            "/sandbox/input/sample",
            config.timeout,
            config,
        ).await?;
        println!("[Sandbox] Execution complete: exit_code={}", exit_code);

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

        // Verify sandbox image exists before attempting to create container
        self.verify_image_exists(image).await?;

        // Create container with security restrictions
        let mut host_config = bollard::models::HostConfig::default();
        host_config.memory = Some(config.memory_limit as i64);
        host_config.memory_swap = Some(config.memory_limit as i64); // No swap
        host_config.nano_cpus = Some(1_000_000_000); // 1 CPU

        // Configure network based on capture_network setting
        if config.capture_network {
            // Enable network with isolation - creates a bridge network for capturing traffic
            // This allows tcpdump to capture packets while still isolating from host
            host_config.network_mode = Some("bridge".to_string());
        } else {
            // Complete network isolation
            host_config.network_mode = Some("none".to_string());
        }

        // Enable read-only root filesystem for additional security
        host_config.readonly_rootfs = Some(true);

        // Create tmpfs mounts for writable directories
        let mut tmpfs = HashMap::new();
        tmpfs.insert("/tmp".to_string(), "size=64M,mode=1777".to_string());
        tmpfs.insert("/sandbox/input".to_string(), "size=128M,mode=0755".to_string());
        tmpfs.insert("/sandbox/output".to_string(), "size=512M,mode=0755".to_string());
        tmpfs.insert("/sandbox/output/memory".to_string(), "size=256M,mode=0755".to_string());
        tmpfs.insert("/sandbox/output/screenshots".to_string(), "size=128M,mode=0755".to_string());
        host_config.tmpfs = Some(tmpfs);

        // Apply seccomp profile to restrict syscalls
        let seccomp_json = super::seccomp::to_docker_seccomp_json()
            .map_err(|e| SandboxError::ContainerCreation(format!("Failed to generate seccomp profile: {}", e)))?;

        host_config.security_opt = Some(vec![
            "no-new-privileges:true".to_string(),
            format!("seccomp={}", seccomp_json),
        ]);
        host_config.cap_drop = Some(vec!["ALL".to_string()]);

        // Add essential capabilities
        let mut caps = vec!["SYS_PTRACE".to_string()]; // For strace
        if config.capture_network {
            // Add NET_RAW and NET_ADMIN for tcpdump
            caps.push("NET_RAW".to_string());
            caps.push("NET_ADMIN".to_string());
        }
        host_config.cap_add = Some(caps);
        host_config.pids_limit = Some(256); // Limit number of processes

        let container_config = Config {
            image: Some(image.to_string()),
            host_config: Some(host_config),
            network_disabled: Some(!config.capture_network), // Disable network unless capturing
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

    /// Verify that the sandbox Docker image exists before attempting to create a container.
    /// Provides a helpful error message directing users to build the image if missing.
    async fn verify_image_exists(&self, image: &str) -> Result<(), SandboxError> {
        use bollard::image::ListImagesOptions;

        let options = ListImagesOptions::<String> {
            all: false,
            ..Default::default()
        };

        let images = self.docker
            .list_images(Some(options))
            .await
            .map_err(|e| SandboxError::DockerConnection(format!("Failed to list Docker images: {}", e)))?;

        let image_exists = images.iter().any(|img| {
            img.repo_tags.iter().any(|tag| tag == image)
        });

        if !image_exists {
            let build_instructions = if image.contains("windows") {
                "Run 'docker/build-sandbox.sh --with-windows' on a Windows Docker host"
            } else {
                "Run 'docker/build-sandbox.sh' to build the sandbox image"
            };

            return Err(SandboxError::ContainerCreation(format!(
                "Sandbox image '{}' not found. {}. \
                The sandbox requires a pre-built Docker image with monitoring tools (strace, inotify, tcpdump).",
                image, build_instructions
            )));
        }

        Ok(())
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

        // Upload to container at the specified path
        let options = UploadToContainerOptions {
            path: container_path,
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
        config: &SandboxConfig,
    ) -> Result<(i32, String, String), SandboxError> {
        // Apply anti-evasion measures if configured
        if let Some(tier) = config.anti_evasion_tier {
            println!("[Sandbox] Applying anti-evasion tier {}", tier);

            // Create anti-evasion manager with custom config if needed
            // Currently using default config, but this allows for future customization
            use super::anti_evasion::AntiEvasionConfig;
            let anti_evasion_config = AntiEvasionConfig::default();
            let anti_evasion = AntiEvasionManager::with_config(anti_evasion_config);

            // Generate appropriate script based on tier
            let script = if tier >= 2 {
                // Tier 2 includes both tier 1 environment setup and tier 2 behavioral simulation
                format!("{}\n{}",
                    anti_evasion.generate_tier1_script(),
                    anti_evasion.generate_tier2_script()
                )
            } else {
                // Tier 1 only
                anti_evasion.generate_tier1_script()
            };

            // Upload anti-evasion script to container
            self.upload_script_to_container(container_id, &script, "/tmp/anti_evasion.sh").await?;

            // Make script executable
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/anti_evasion.sh"]).await?;

            // Execute anti-evasion script
            println!("[Sandbox] Executing anti-evasion setup script");
            let (exit_code, stdout, stderr) = self.execute_script(container_id, "/tmp/anti_evasion.sh", Duration::from_secs(30)).await?;

            if exit_code != 0 {
                eprintln!("[Sandbox] Warning: Anti-evasion script exited with code {}", exit_code);
                eprintln!("[Sandbox] Anti-evasion stderr: {}", stderr);
            } else {
                println!("[Sandbox] Anti-evasion setup complete");
                if !stdout.is_empty() {
                    println!("[Sandbox] Anti-evasion output: {}", stdout);
                }
            }
        }

        // Start network capture if enabled
        if config.capture_network {
            println!("[Sandbox] Starting network capture");

            // Create network capture script
            let network_script = r#"#!/bin/bash
# Start tcpdump in background to capture all network traffic
tcpdump -i any -w /sandbox/output/network.pcap 2>/dev/null &
TCPDUMP_PID=$!
echo $TCPDUMP_PID > /tmp/tcpdump.pid
echo "Network capture started (PID: $TCPDUMP_PID)"
"#;

            // Upload and execute network capture script
            self.upload_script_to_container(container_id, network_script, "/tmp/start_network_capture.sh").await?;
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/start_network_capture.sh"]).await?;

            let (exit_code, stdout, stderr) = self.execute_script(
                container_id,
                "/tmp/start_network_capture.sh",
                Duration::from_secs(5)
            ).await?;

            if exit_code != 0 {
                eprintln!("[Sandbox] Warning: Network capture script exited with code {}", exit_code);
                eprintln!("[Sandbox] Network capture stderr: {}", stderr);
            } else {
                println!("[Sandbox] Network capture started successfully");
                if !stdout.is_empty() {
                    println!("[Sandbox] Network capture output: {}", stdout);
                }
            }
        }

        // Set up memory capture if configured
        if let Some(mem_config) = &config.memory_capture_config {
            println!("[Sandbox] Setting up memory capture");
            let mem_mgr = MemoryCaptureManager::with_config(mem_config.clone());

            // Generate and upload memory dump script
            // Note: We use SAMPLE_PID as a placeholder that will be replaced by the monitor_agent.sh script
            let dump_script = mem_mgr.generate_dump_script("SAMPLE_PID");

            // Upload memory dump script to container
            self.upload_script_to_container(container_id, &dump_script, "/tmp/memory_capture.sh").await?;

            // Make script executable
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/memory_capture.sh"]).await?;

            println!("[Sandbox] Memory capture script ready");

            // The monitor_agent.sh script will source this and use the dump_memory function
            // We'll also need to add the exit dump script at the end
        }

        // Start video recording if enabled
        if config.capture_video {
            println!("[Sandbox] Starting video capture");
            let video_manager = VideoCaptureManager::with_config(
                config.video_config.clone().unwrap_or_default()
            );

            // Generate and upload start script
            let start_script = video_manager.generate_start_script("/sandbox/output");
            self.upload_script_to_container(container_id, &start_script, "/tmp/start_video.sh").await?;
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/start_video.sh"]).await?;

            // Execute start script (non-blocking - processes run in background)
            println!("[Sandbox] Executing video recording start script");
            let (exit_code, stdout, stderr) = self.execute_script(
                container_id,
                "/tmp/start_video.sh",
                Duration::from_secs(10)
            ).await?;

            if exit_code != 0 {
                eprintln!("[Sandbox] Warning: Video capture start script exited with code {}", exit_code);
                eprintln!("[Sandbox] Video stderr: {}", stderr);
            } else {
                println!("[Sandbox] Video capture started successfully");
                if !stdout.is_empty() {
                    println!("[Sandbox] Video output: {}", stdout);
                }
            }

            // Optional: Start user simulation for anti-evasion
            let user_sim_script = video_manager.generate_user_simulation_script();
            self.upload_script_to_container(container_id, &user_sim_script, "/tmp/user_sim.sh").await?;
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/user_sim.sh"]).await?;

            // Start user simulation in background (fire and forget)
            println!("[Sandbox] Starting user simulation for anti-evasion");
            let _ = self.execute_script(container_id, "/tmp/user_sim.sh", Duration::from_secs(5)).await;
        }

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

        // Stop network capture if it was enabled
        if config.capture_network {
            println!("[Sandbox] Stopping network capture");

            // Create stop script that kills tcpdump gracefully
            let stop_network_script = r#"#!/bin/bash
if [ -f /tmp/tcpdump.pid ]; then
    TCPDUMP_PID=$(cat /tmp/tcpdump.pid)
    if kill -0 $TCPDUMP_PID 2>/dev/null; then
        kill -TERM $TCPDUMP_PID
        # Wait up to 2 seconds for tcpdump to finish writing
        for i in {1..20}; do
            if ! kill -0 $TCPDUMP_PID 2>/dev/null; then
                break
            fi
            sleep 0.1
        done
        echo "Network capture stopped (PID: $TCPDUMP_PID)"
    else
        echo "tcpdump process not running"
    fi
else
    echo "No tcpdump PID file found"
fi
"#;

            self.upload_script_to_container(container_id, stop_network_script, "/tmp/stop_network_capture.sh").await?;
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/stop_network_capture.sh"]).await?;

            let (stop_code, stop_stdout, stop_stderr) = self.execute_script(
                container_id,
                "/tmp/stop_network_capture.sh",
                Duration::from_secs(5)
            ).await?;

            if stop_code != 0 {
                eprintln!("[Sandbox] Warning: Network capture stop script exited with code {}", stop_code);
                eprintln!("[Sandbox] Stop stderr: {}", stop_stderr);
            } else {
                println!("[Sandbox] Network capture stopped successfully");
                if !stop_stdout.is_empty() {
                    println!("[Sandbox] Stop output: {}", stop_stdout);
                }
            }
        }

        // Stop video recording if it was enabled
        if config.capture_video {
            println!("[Sandbox] Stopping video capture");
            let video_manager = VideoCaptureManager::with_config(
                config.video_config.clone().unwrap_or_default()
            );

            // Generate and upload stop script
            let stop_script = video_manager.generate_stop_script("/sandbox/output");
            self.upload_script_to_container(container_id, &stop_script, "/tmp/stop_video.sh").await?;
            self.execute_simple_command(container_id, vec!["chmod", "+x", "/tmp/stop_video.sh"]).await?;

            // Execute stop script
            println!("[Sandbox] Executing video recording stop script");
            let (stop_code, stop_stdout, stop_stderr) = self.execute_script(
                container_id,
                "/tmp/stop_video.sh",
                Duration::from_secs(10)
            ).await?;

            if stop_code != 0 {
                eprintln!("[Sandbox] Warning: Video capture stop script exited with code {}", stop_code);
                eprintln!("[Sandbox] Stop stderr: {}", stop_stderr);
            } else {
                println!("[Sandbox] Video capture stopped successfully");
                if !stop_stdout.is_empty() {
                    println!("[Sandbox] Stop output: {}", stop_stdout);
                }
            }
        }
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
        let mut memory_maps_files: HashMap<String, String> = HashMap::new(); // filename -> content

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
                                } else if filename.starts_with("maps_") && filename.ends_with(".txt") {
                                    // Read memory maps file for analysis
                                    let mut maps_content = String::new();
                                    if entry.read_to_string(&mut maps_content).is_ok() {
                                        memory_maps_files.insert(filename, maps_content);
                                    }
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

        // Analyze memory maps if available using MemoryCaptureManager
        let mut behavioral_events = behavioral_events; // Make mutable
        if !memory_maps_files.is_empty() {
            let mem_mgr = MemoryCaptureManager::new();

            for (filename, maps_content) in &memory_maps_files {
                println!("[Sandbox] Analyzing memory maps from {}", filename);

                // Parse memory regions
                let regions = mem_mgr.parse_memory_maps(maps_content);

                // Analyze for suspicious patterns
                let findings = mem_mgr.analyze_regions(&regions);

                if !findings.is_empty() {
                    println!("[Sandbox] Found {} suspicious memory patterns in {}", findings.len(), filename);

                    // Convert memory findings to behavioral events
                    for finding in findings {
                        behavioral_events.push(BehaviorEvent {
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or(Duration::ZERO)
                                .as_millis() as u64,
                            event_type: "MemoryAnomaly".to_string(),
                            description: finding.description,
                            severity: match finding.confidence {
                                c if c >= 0.9 => "Critical",
                                c if c >= 0.7 => "High",
                                c if c >= 0.5 => "Medium",
                                _ => "Low",
                            }.to_string(),
                            mitre_attack_id: finding.mitre_attack_id,
                        });
                    }
                }
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

        // Check PCAP magic number - bounds checked above
        if pcap_data.len() < 4 {
            eprintln!("[Sandbox] PCAP data too short for magic number");
            return connections;
        }
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
            // Bounds check for packet header access
            if offset + 12 > pcap_data.len() {
                eprintln!("[Sandbox] PCAP packet header truncated at offset {}", offset);
                break;
            }
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

                // Check Ethernet type (bytes 12-13) - bounds check
                if packet.len() < 14 {
                    offset += incl_len;
                    packet_count += 1;
                    continue;
                }
                let eth_type = u16::from_be_bytes([packet[12], packet[13]]);

                if eth_type == 0x0800 { // IPv4
                    let ip_header_start = 14;

                    // Bounds check for IP header (minimum 20 bytes)
                    if packet.len() < ip_header_start + 20 {
                        offset += incl_len;
                        packet_count += 1;
                        continue;
                    }

                    if packet.len() > ip_header_start + 20 {
                        let ip_proto = packet[ip_header_start + 9];

                        // Bounds check for source IP (bytes 12-15)
                        if packet.len() < ip_header_start + 16 {
                            offset += incl_len;
                            packet_count += 1;
                            continue;
                        }
                        let src_ip = format!("{}.{}.{}.{}",
                            packet[ip_header_start + 12],
                            packet[ip_header_start + 13],
                            packet[ip_header_start + 14],
                            packet[ip_header_start + 15]
                        );

                        // Bounds check for destination IP (bytes 16-19)
                        if packet.len() < ip_header_start + 20 {
                            offset += incl_len;
                            packet_count += 1;
                            continue;
                        }
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
                                // Bounds check for TCP ports (need 4 bytes)
                                if packet.len() < transport_start + 4 {
                                    // Skip if not enough data for ports
                                } else if packet.len() > transport_start + 4 {
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
                                // Bounds check for UDP ports (need 4 bytes)
                                if packet.len() < transport_start + 4 {
                                    // Skip if not enough data for ports
                                } else if packet.len() > transport_start + 4 {
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

    /// Helper method to upload a script to the container
    async fn upload_script_to_container(
        &self,
        container_id: &str,
        script_content: &str,
        container_path: &str,
    ) -> Result<(), SandboxError> {
        let bytes = script_content.as_bytes();

        // Create tar archive in memory
        let mut archive_builder = tar::Builder::new(Vec::new());
        let mut header = tar::Header::new_gnu();
        header.set_size(bytes.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();

        // Extract filename from path
        let filename = std::path::Path::new(container_path)
            .file_name()
            .ok_or_else(|| SandboxError::FileCopy("Invalid container path".to_string()))?
            .to_string_lossy();

        archive_builder.append_data(&mut header, filename.as_ref(), bytes)
            .map_err(|e| SandboxError::FileCopy(format!("Failed to create tar archive: {}", e)))?;

        let tar_data = archive_builder.into_inner()
            .map_err(|e| SandboxError::FileCopy(format!("Failed to finalize tar archive: {}", e)))?;

        // Extract directory from path
        let dir_path = std::path::Path::new(container_path)
            .parent()
            .ok_or_else(|| SandboxError::FileCopy("Invalid container path".to_string()))?
            .to_string_lossy();

        // Upload to container
        let options = UploadToContainerOptions {
            path: dir_path.as_ref(),
            ..Default::default()
        };

        self.docker
            .upload_to_container(container_id, Some(options), tar_data.into())
            .await
            .map_err(|e| SandboxError::FileCopy(format!("Failed to upload script to container: {}", e)))?;

        Ok(())
    }

    /// Helper method to execute a simple command in the container (no output capture)
    async fn execute_simple_command(
        &self,
        container_id: &str,
        cmd: Vec<&str>,
    ) -> Result<(), SandboxError> {
        let exec_config = CreateExecOptions {
            cmd: Some(cmd),
            attach_stdout: Some(false),
            attach_stderr: Some(false),
            ..Default::default()
        };

        let exec = self.docker.create_exec(container_id, exec_config)
            .await
            .map_err(|e| SandboxError::Execution(format!("Failed to create exec: {}", e)))?;

        self.docker.start_exec(&exec.id, None)
            .await
            .map_err(|e| SandboxError::Execution(format!("Failed to execute command: {}", e)))?;

        Ok(())
    }

    /// Helper method to execute a script and capture output
    async fn execute_script(
        &self,
        container_id: &str,
        script_path: &str,
        timeout: Duration,
    ) -> Result<(i32, String, String), SandboxError> {
        let exec_config = CreateExecOptions {
            cmd: Some(vec!["/bin/bash", script_path]),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };

        let exec = self.docker.create_exec(container_id, exec_config)
            .await
            .map_err(|e| SandboxError::Execution(format!("Failed to create exec: {}", e)))?;

        // Execute with timeout
        let exec_result = tokio::time::timeout(
            timeout,
            self.docker.start_exec(&exec.id, None),
        )
        .await
        .map_err(|_| SandboxError::Timeout)?
        .map_err(|e| SandboxError::Execution(format!("Script execution failed: {}", e)))?;

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
                            eprintln!("[Sandbox] Error reading script output: {}", e);
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
            memory_limit: 256 * 1024 * 1024,
            anti_evasion_tier: None,
            memory_capture_config: None,
            capture_video: false,
            video_config: None,
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

    #[tokio::test]
    #[ignore] // Only run when Docker is available and image is built
    async fn test_anti_evasion_tier1() {
        let orchestrator = SandboxOrchestrator::new().await.unwrap();

        let config = SandboxConfig {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(10),
            capture_network: false,
            memory_limit: 256 * 1024 * 1024,
            anti_evasion_tier: Some(1), // Enable tier 1
            memory_capture_config: None,
            capture_video: false,
            video_config: None,
        };

        let result = orchestrator
            .execute_sample(PathBuf::from("/bin/echo"), config)
            .await;

        assert!(result.is_ok(), "Sandbox execution with anti-evasion failed: {:?}", result.err());
    }

    #[tokio::test]
    #[ignore] // Only run when Docker is available and image is built
    async fn test_anti_evasion_tier2() {
        let orchestrator = SandboxOrchestrator::new().await.unwrap();

        let config = SandboxConfig {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(10),
            capture_network: false,
            memory_limit: 256 * 1024 * 1024,
            anti_evasion_tier: Some(2), // Enable tier 2 (includes tier 1)
            memory_capture_config: None,
            capture_video: false,
            video_config: None,
        };

        let result = orchestrator
            .execute_sample(PathBuf::from("/bin/echo"), config)
            .await;

        assert!(result.is_ok(), "Sandbox execution with tier 2 anti-evasion failed: {:?}", result.err());
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

    #[test]
    fn test_memory_capture_manager_integration() {
        // Test that MemoryCaptureManager can be used to analyze memory maps
        use crate::sandbox::memory_capture::MemoryCaptureManager;

        let mem_mgr = MemoryCaptureManager::new();

        // Sample memory maps with suspicious RWX region
        let maps_content = r#"00400000-00452000 r-xp 00000000 08:01 1234 /bin/sample
00651000-00652000 r--p 00051000 08:01 1234 /bin/sample
00652000-00653000 rw-p 00052000 08:01 1234 /bin/sample
7f9a8c000000-7f9a8c021000 rwxp 00000000 00:00 0 [heap]
7fff12345000-7fff12366000 rw-p 00000000 00:00 0 [stack]
"#;

        let regions = mem_mgr.parse_memory_maps(maps_content);
        assert_eq!(regions.len(), 5);

        // Analyze for suspicious patterns
        let findings = mem_mgr.analyze_regions(&regions);

        // Should detect RWX heap (suspicious)
        assert!(findings.len() > 0, "Should detect suspicious RWX heap region");
        assert!(findings.iter().any(|f| matches!(
            f.finding_type,
            crate::sandbox::memory_capture::SuspiciousFindingType::ExecutableHeap
        )));
    }

    #[tokio::test]
    #[ignore] // Only run when Docker is available and image is built
    async fn test_memory_capture_config() {
        use crate::sandbox::memory_capture::{MemoryCaptureConfig, DumpTrigger};

        let orchestrator = SandboxOrchestrator::new().await.unwrap();

        // Configure memory capture
        let mem_config = MemoryCaptureConfig {
            enabled: true,
            triggers: vec![
                DumpTrigger::ProcessStart,
                DumpTrigger::ProcessExit,
            ],
            max_dump_size: 100 * 1024 * 1024, // 100MB
            dump_interval_ms: 5000,
            auto_dump_on_suspicious: true,
            suspicious_syscalls: vec!["ptrace".to_string(), "mprotect".to_string()],
            extract_strings: true,
            min_string_length: 4,
        };

        let config = SandboxConfig {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(10),
            capture_network: false,
            memory_limit: 256 * 1024 * 1024,
            anti_evasion_tier: None,
            memory_capture_config: Some(mem_config),
            capture_video: false,
            video_config: None,
        };

        // Test with /bin/echo (harmless)
        let result = orchestrator
            .execute_sample(PathBuf::from("/bin/echo"), config)
            .await;

        assert!(result.is_ok(), "Sandbox execution with memory capture failed: {:?}", result.err());
        // Note: Actual memory dumps depend on the monitor_agent.sh script supporting the memory capture hooks
    }
}
