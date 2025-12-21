import { invoke } from '@tauri-apps/api/core';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  created: number;
}

export interface ContainerExecutionResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

/**
 * Container Service - Provides interface to Docker container management
 * for malware sandboxing and isolated execution
 */
export class ContainerService {
  /**
   * Check if Docker is available on the system
   */
  static async checkDockerAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('check_docker_available');
    } catch (error) {
      console.error('Failed to check Docker availability:', error);
      return false;
    }
  }

  /**
   * Create a new sandbox container with resource limits
   * @param image - Docker image to use (e.g., "alpine:latest")
   * @param memoryLimit - Memory limit in bytes (e.g., 256MB = 256 * 1024 * 1024)
   * @param cpuLimit - CPU limit as fraction (e.g., 0.5 = 50% of one CPU)
   */
  static async createSandboxContainer(
    image: string,
    memoryLimit: number,
    cpuLimit: number
  ): Promise<ContainerInfo> {
    try {
      return await invoke<ContainerInfo>('create_sandbox_container', {
        image,
        memoryLimit,
        cpuLimit,
      });
    } catch (error) {
      console.error('Failed to create sandbox container:', error);
      throw new Error(`Container creation failed: ${error}`);
    }
  }

  /**
   * Execute a command in a running container
   * @param containerId - Container ID
   * @param command - Command to execute as array (e.g., ["ls", "-la"])
   * @param timeoutSecs - Timeout in seconds
   */
  static async executeInContainer(
    containerId: string,
    command: string[],
    timeoutSecs: number
  ): Promise<ContainerExecutionResult> {
    try {
      return await invoke<ContainerExecutionResult>('execute_in_container', {
        containerId,
        command,
        timeoutSecs,
      });
    } catch (error) {
      console.error('Failed to execute command in container:', error);
      throw new Error(`Command execution failed: ${error}`);
    }
  }

  /**
   * Stop a running container
   * @param containerId - Container ID
   */
  static async stopContainer(containerId: string): Promise<void> {
    try {
      await invoke('stop_container', { containerId });
    } catch (error) {
      console.error('Failed to stop container:', error);
      throw new Error(`Container stop failed: ${error}`);
    }
  }

  /**
   * Remove a container
   * @param containerId - Container ID
   */
  static async removeContainer(containerId: string): Promise<void> {
    try {
      await invoke('remove_container', { containerId });
    } catch (error) {
      console.error('Failed to remove container:', error);
      throw new Error(`Container removal failed: ${error}`);
    }
  }

  /**
   * List all Athena sandbox containers
   */
  static async listSandboxContainers(): Promise<ContainerInfo[]> {
    try {
      return await invoke<ContainerInfo[]>('list_sandbox_containers');
    } catch (error) {
      console.error('Failed to list containers:', error);
      throw new Error(`Container listing failed: ${error}`);
    }
  }

  /**
   * Get logs from a container
   * @param containerId - Container ID
   */
  static async getContainerLogs(containerId: string): Promise<string> {
    try {
      return await invoke<string>('get_container_logs', { containerId });
    } catch (error) {
      console.error('Failed to get container logs:', error);
      throw new Error(`Log retrieval failed: ${error}`);
    }
  }

  /**
   * Analyze a file in a sandbox container
   * @param filePath - Path to the file to analyze
   * @param image - Docker image to use for analysis
   * @param memoryLimit - Memory limit in bytes (default 256MB)
   * @param cpuLimit - CPU limit as fraction (default 0.5)
   * @param timeoutSecs - Analysis timeout in seconds (default 300)
   */
  static async analyzeFileInSandbox(
    filePath: string,
    image: string = 'alpine:latest',
    memoryLimit: number = 256 * 1024 * 1024,
    cpuLimit: number = 0.5,
    timeoutSecs: number = 300
  ): Promise<{ container: ContainerInfo; result: ContainerExecutionResult }> {
    let containerId: string | null = null;

    try {
      // Create container
      const container = await this.createSandboxContainer(image, memoryLimit, cpuLimit);
      containerId = container.id;

      // Execute analysis command
      const result = await this.executeInContainer(
        containerId,
        ['file', filePath],
        timeoutSecs
      );

      return { container, result };
    } finally {
      // Always cleanup the container
      if (containerId) {
        try {
          await this.removeContainer(containerId);
        } catch (cleanupError) {
          console.warn('Failed to cleanup container:', cleanupError);
        }
      }
    }
  }

  /**
   * Run malware sample in isolated container for behavioral analysis
   * @param samplePath - Path to malware sample
   * @param analysisScript - Script to run for analysis
   * @param timeoutSecs - Analysis timeout
   */
  static async runMalwareAnalysis(
    samplePath: string,
    analysisScript: string[],
    timeoutSecs: number = 300
  ): Promise<ContainerExecutionResult> {
    const image = 'ubuntu:latest'; // Use appropriate analysis image
    const memoryLimit = 512 * 1024 * 1024; // 512MB for malware analysis
    const cpuLimit = 1.0; // Full CPU for faster analysis

    let containerId: string | null = null;

    try {
      // Create isolated container
      const container = await this.createSandboxContainer(image, memoryLimit, cpuLimit);
      containerId = container.id;

      // Run analysis
      const result = await this.executeInContainer(
        containerId,
        analysisScript,
        timeoutSecs
      );

      return result;
    } finally {
      // Always cleanup
      if (containerId) {
        try {
          await this.removeContainer(containerId);
        } catch (cleanupError) {
          console.warn('Failed to cleanup analysis container:', cleanupError);
        }
      }
    }
  }
}

export default ContainerService;
