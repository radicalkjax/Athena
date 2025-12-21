use bollard::Docker;
use bollard::container::{
    Config, CreateContainerOptions, StartContainerOptions, StopContainerOptions,
    RemoveContainerOptions, LogsOptions, ListContainersOptions,
};
use bollard::exec::{CreateExecOptions, StartExecResults};
use bollard::image::CreateImageOptions;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::default::Default;
use tauri::command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub created: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerExecutionResult {
    pub exit_code: i64,
    pub stdout: String,
    pub stderr: String,
    pub execution_time_ms: u64,
}

/// Check if Docker is available on the system
#[command]
pub async fn check_docker_available() -> Result<bool, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            // Try to ping Docker to verify it's actually running
            match docker.ping().await {
                Ok(_) => Ok(true),
                Err(e) => {
                    eprintln!("Docker ping failed: {}", e);
                    Ok(false)
                }
            }
        }
        Err(e) => {
            eprintln!("Docker connection failed: {}", e);
            Ok(false)
        }
    }
}

/// Create a sandbox container with resource limits
#[command]
pub async fn create_sandbox_container(
    image: String,
    memory_limit: u64,
    cpu_limit: f64,
) -> Result<ContainerInfo, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}. Is Docker running?", e))?;

    // First, pull the image if it doesn't exist locally
    let image_parts: Vec<&str> = image.split(':').collect();
    let image_name = image_parts[0];
    let image_tag = image_parts.get(1).unwrap_or(&"latest");

    println!("Pulling image {}:{}...", image_name, image_tag);

    let create_image_options = CreateImageOptions {
        from_image: image_name,
        tag: image_tag,
        ..Default::default()
    };

    let mut pull_stream = docker.create_image(Some(create_image_options), None, None);

    while let Some(result) = pull_stream.next().await {
        match result {
            Ok(info) => {
                if let Some(status) = info.status {
                    println!("Image pull: {}", status);
                }
            }
            Err(e) => {
                eprintln!("Warning during image pull: {}", e);
            }
        }
    }

    // Create container configuration with security settings
    let mut host_config = bollard::models::HostConfig::default();
    host_config.memory = Some(memory_limit as i64);
    host_config.nano_cpus = Some((cpu_limit * 1_000_000_000.0) as i64);
    host_config.network_mode = Some("none".to_string()); // Isolate from network
    host_config.readonly_rootfs = Some(true); // Read-only root filesystem
    host_config.security_opt = Some(vec!["no-new-privileges".to_string()]);
    host_config.cap_drop = Some(vec!["ALL".to_string()]); // Drop all capabilities

    let config = Config {
        image: Some(image.clone()),
        host_config: Some(host_config),
        network_disabled: Some(true),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(false),
        ..Default::default()
    };

    // Generate a unique container name
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?
        .as_secs();
    let container_name = format!("athena-sandbox-{}", timestamp);

    let options = CreateContainerOptions {
        name: container_name.clone(),
        platform: None,
    };

    let container = docker
        .create_container(Some(options), config)
        .await
        .map_err(|e| format!("Failed to create container: {}", e))?;

    // Start the container
    docker
        .start_container(&container.id, None::<StartContainerOptions<String>>)
        .await
        .map_err(|e| format!("Failed to start container: {}", e))?;

    let created = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?
        .as_secs() as i64;

    Ok(ContainerInfo {
        id: container.id.clone(),
        name: container_name,
        image: image.clone(),
        status: "running".to_string(),
        created,
    })
}

/// Execute a command in a running container with timeout
#[command]
pub async fn execute_in_container(
    container_id: String,
    command: Vec<String>,
    timeout_secs: u64,
) -> Result<ContainerExecutionResult, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let start_time = SystemTime::now();

    // Create exec instance
    let exec_config = CreateExecOptions {
        cmd: Some(command),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        ..Default::default()
    };

    let exec = docker
        .create_exec(&container_id, exec_config)
        .await
        .map_err(|e| format!("Failed to create exec: {}", e))?;

    // Start exec with timeout
    let exec_result = tokio::time::timeout(
        tokio::time::Duration::from_secs(timeout_secs),
        docker.start_exec(&exec.id, None),
    )
    .await
    .map_err(|_| format!("Command execution timed out after {} seconds", timeout_secs))?
    .map_err(|e| format!("Failed to start exec: {}", e))?;

    let mut stdout = String::new();
    let mut stderr = String::new();

    match exec_result {
        StartExecResults::Attached { mut output, .. } => {
            while let Some(result) = output.next().await {
                match result {
                    Ok(log) => {
                        match &log {
                            bollard::container::LogOutput::StdOut { .. } => {
                                let text = String::from_utf8_lossy(&log.into_bytes()).to_string();
                                stdout.push_str(&text);
                            },
                            bollard::container::LogOutput::StdErr { .. } => {
                                let text = String::from_utf8_lossy(&log.into_bytes()).to_string();
                                stderr.push_str(&text);
                            },
                            _ => {}
                        }
                    }
                    Err(e) => {
                        return Err(format!("Error reading output: {}", e));
                    }
                }
            }
        }
        StartExecResults::Detached => {
            return Err("Unexpected detached execution".to_string());
        }
    }

    // Get exit code
    let inspect = docker
        .inspect_exec(&exec.id)
        .await
        .map_err(|e| format!("Failed to inspect exec: {}", e))?;

    let exit_code = inspect.exit_code.unwrap_or(-1) as i64;

    let execution_time_ms = SystemTime::now()
        .duration_since(start_time)
        .map_err(|e| format!("Time calculation error: {}", e))?
        .as_millis() as u64;

    Ok(ContainerExecutionResult {
        exit_code,
        stdout,
        stderr,
        execution_time_ms,
    })
}

/// Stop a running container
#[command]
pub async fn stop_container(container_id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = StopContainerOptions {
        t: 10, // 10 second timeout before force kill
    };

    docker
        .stop_container(&container_id, Some(options))
        .await
        .map_err(|e| format!("Failed to stop container: {}", e))?;

    Ok(())
}

/// Remove a container
#[command]
pub async fn remove_container(container_id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // Stop the container first if it's running
    let _ = stop_container(container_id.clone()).await;

    let options = RemoveContainerOptions {
        force: true,
        v: true, // Remove volumes
        ..Default::default()
    };

    docker
        .remove_container(&container_id, Some(options))
        .await
        .map_err(|e| format!("Failed to remove container: {}", e))?;

    Ok(())
}

/// List all Athena sandbox containers
#[command]
pub async fn list_sandbox_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let mut filters = HashMap::new();
    filters.insert("name".to_string(), vec!["athena-sandbox-".to_string()]);

    let options = ListContainersOptions {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let mut result = Vec::new();

    for container in containers {
        let id = container.id.unwrap_or_default();
        let name = container
            .names
            .and_then(|names| names.first().map(|n| n.trim_start_matches('/').to_string()))
            .unwrap_or_default();
        let image = container.image.unwrap_or_default();
        let status = container.status.unwrap_or_default();
        let created = container.created.unwrap_or(0);

        result.push(ContainerInfo {
            id,
            name,
            image,
            status,
            created,
        });
    }

    Ok(result)
}

/// Get logs from a container
#[command]
pub async fn get_container_logs(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        tail: "1000".to_string(), // Last 1000 lines
        ..Default::default()
    };

    let mut log_stream = docker.logs(&container_id, Some(options));

    let mut logs = String::new();

    while let Some(result) = log_stream.next().await {
        match result {
            Ok(log) => {
                logs.push_str(&String::from_utf8_lossy(&log.into_bytes()));
            }
            Err(e) => {
                return Err(format!("Failed to read logs: {}", e));
            }
        }
    }

    Ok(logs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_docker_available() {
        // This test will only pass if Docker is running
        let result = check_docker_available().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore] // Ignore by default as it requires Docker
    async fn test_container_lifecycle() {
        // Test creating, executing, and removing a container
        let container = create_sandbox_container(
            "alpine:latest".to_string(),
            256 * 1024 * 1024, // 256MB
            0.5, // 0.5 CPU
        )
        .await
        .expect("Failed to create container");

        assert!(!container.id.is_empty());

        // Execute a simple command
        let result = execute_in_container(
            container.id.clone(),
            vec!["echo".to_string(), "hello".to_string()],
            10,
        )
        .await
        .expect("Failed to execute command");

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("hello"));

        // Clean up
        remove_container(container.id)
            .await
            .expect("Failed to remove container");
    }
}
