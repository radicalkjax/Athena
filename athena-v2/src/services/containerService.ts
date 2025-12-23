import { invoke } from '@tauri-apps/api/core';

/**
 * SECURITY: Whitelist of allowed commands that can be executed in containers
 * This prevents command injection attacks by only allowing known-safe binaries
 */
const ALLOWED_COMMANDS: Set<string> = new Set([
  // File analysis tools
  'file',           // Determine file type
  'strings',        // Extract strings from binary
  'hexdump',        // Hex dump of file
  'xxd',            // Hex dump alternative
  'readelf',        // ELF file analysis
  'objdump',        // Object file analysis
  'nm',             // List symbols
  'ldd',            // List shared libraries

  // System info (read-only)
  'cat',            // Read files (sandboxed)
  'ls',             // List directory
  'head',           // First lines of file
  'tail',           // Last lines of file
  'stat',           // File statistics
  'md5sum',         // File hash
  'sha256sum',      // File hash
  'sha1sum',        // File hash

  // Process monitoring
  'ps',             // List processes
  'strace',         // System call tracing
  'ltrace',         // Library call tracing

  // Network analysis (read-only)
  'tcpdump',        // Network capture
  'netstat',        // Network statistics

  // Malware analysis specific
  'upx',            // Unpacker detection
  'yara',           // YARA scanning
]);

/**
 * Validate that a command is in the whitelist
 * @throws Error if command is not allowed
 */
function validateCommand(command: string[]): void {
  if (!command || command.length === 0) {
    throw new Error('Command cannot be empty');
  }

  const executable = command[0];

  // Extract just the binary name (handle paths like /usr/bin/file)
  const binaryName = executable.split('/').pop() || executable;

  if (!ALLOWED_COMMANDS.has(binaryName)) {
    throw new Error(
      `Command '${binaryName}' is not in the allowed whitelist. ` +
      `Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
    );
  }

  // Additional security: check for shell metacharacters in arguments
  const dangerousPatterns = [
    /[;&|`$(){}]/,     // Shell operators
    /\$\(/,            // Command substitution
    /`/,               // Backtick substitution
    />\s*\//,          // Redirect to absolute path
    /\|\s*\w+/,        // Pipe to command
  ];

  for (let i = 1; i < command.length; i++) {
    const arg = command[i];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(arg)) {
        throw new Error(
          `Argument '${arg}' contains potentially dangerous shell metacharacters`
        );
      }
    }
  }
}

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
   * SECURITY: Commands are validated against a whitelist before execution
   * @param containerId - Container ID
   * @param command - Command to execute as array (e.g., ["ls", "-la"])
   * @param timeoutSecs - Timeout in seconds
   * @throws Error if command is not in the allowed whitelist
   */
  static async executeInContainer(
    containerId: string,
    command: string[],
    timeoutSecs: number
  ): Promise<ContainerExecutionResult> {
    // SECURITY: Validate command against whitelist before execution
    validateCommand(command);

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
   * @param samplePath - Path to malware sample (used for file command analysis)
   * @param analysisScript - Additional script commands to run for analysis
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

      // First, run file type detection on the sample
      const fileResult = await this.executeInContainer(
        containerId,
        ['file', samplePath],
        30 // 30 second timeout for file command
      );

      // Then run the additional analysis script if provided
      let result = fileResult;
      if (analysisScript.length > 0) {
        result = await this.executeInContainer(
          containerId,
          analysisScript,
          timeoutSecs
        );
        // Combine outputs
        result.stdout = `=== File Analysis ===\n${fileResult.stdout}\n\n=== Script Analysis ===\n${result.stdout}`;
      }

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
