import { v4 as uuidv4 } from 'uuid';
import { 
  ContainerMonitoring, 
  NetworkActivity, 
  FileActivity, 
  ProcessActivity 
} from '../models';
import * as containerService from './container';

/**
 * Create a container monitoring record
 * @param containerId Container ID
 * @param cpuUsage CPU usage percentage
 * @param memoryUsage Memory usage in MB
 * @param diskUsage Disk usage in MB
 * @param networkInbound Network inbound traffic in bytes
 * @param networkOutbound Network outbound traffic in bytes
 * @param processCount Number of processes
 * @param openFileCount Number of open files
 * @param openSocketCount Number of open sockets
 * @param suspiciousActivities Array of suspicious activities
 * @returns Container monitoring record
 */
export const createContainerMonitoring = async (
  containerId: string,
  cpuUsage: number,
  memoryUsage: number,
  diskUsage: number,
  networkInbound: number,
  networkOutbound: number,
  processCount: number,
  openFileCount: number,
  openSocketCount: number,
  suspiciousActivities: string[] = []
): Promise<ContainerMonitoring> => {
  try {
    return await ContainerMonitoring.create({
      id: uuidv4(),
      containerId,
      timestamp: new Date(),
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkInbound,
      networkOutbound,
      processCount,
      openFileCount,
      openSocketCount,
      suspiciousActivities,
    });
  } catch (error: unknown) {
    console.error('Error creating container monitoring:', error);
    throw error;
  }
};

/**
 * Get container monitoring records by container ID
 * @param containerId Container ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Container monitoring records
 */
export const getContainerMonitoringByContainerId = async (
  containerId: string,
  limit: number = 100,
  offset: number = 0
): Promise<ContainerMonitoring[]> => {
  try {
    return await ContainerMonitoring.findAll({
      where: { containerId },
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });
  } catch (error: unknown) {
    console.error('Error getting container monitoring by container ID:', error);
    throw error;
  }
};

/**
 * Create a network activity record
 * @param containerId Container ID
 * @param protocol Network protocol
 * @param sourceIp Source IP address
 * @param sourcePort Source port
 * @param destinationIp Destination IP address
 * @param destinationPort Destination port
 * @param direction Traffic direction
 * @param dataSize Data size in bytes
 * @param duration Connection duration in milliseconds
 * @param status Connection status
 * @param processName Process name
 * @param processId Process ID
 * @param isMalicious Whether the activity is malicious
 * @param maliciousReason Reason for marking as malicious
 * @param payload Network payload
 * @returns Network activity record
 */
export const createNetworkActivity = async (
  containerId: string,
  protocol: 'tcp' | 'udp' | 'icmp' | 'http' | 'https' | 'dns' | 'other',
  sourceIp: string,
  sourcePort: number,
  destinationIp: string,
  destinationPort: number,
  direction: 'inbound' | 'outbound',
  dataSize: number,
  duration: number,
  status: 'established' | 'closed' | 'blocked' | 'attempted',
  processName: string,
  processId: number,
  isMalicious: boolean = false,
  maliciousReason?: string,
  payload?: string
): Promise<NetworkActivity> => {
  try {
    return await NetworkActivity.create({
      id: uuidv4(),
      containerId,
      timestamp: new Date(),
      protocol,
      sourceIp,
      sourcePort,
      destinationIp,
      destinationPort,
      direction,
      dataSize,
      duration,
      status,
      processName,
      processId,
      isMalicious,
      maliciousReason,
      payload,
    });
  } catch (error: unknown) {
    console.error('Error creating network activity:', error);
    throw error;
  }
};

/**
 * Get network activity records by container ID
 * @param containerId Container ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Network activity records
 */
export const getNetworkActivityByContainerId = async (
  containerId: string,
  limit: number = 100,
  offset: number = 0
): Promise<NetworkActivity[]> => {
  try {
    return await NetworkActivity.findAll({
      where: { containerId },
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });
  } catch (error: unknown) {
    console.error('Error getting network activity by container ID:', error);
    throw error;
  }
};

/**
 * Create a file activity record
 * @param containerId Container ID
 * @param operation File operation
 * @param filePath File path
 * @param fileType File type
 * @param fileSize File size in bytes
 * @param filePermissions File permissions
 * @param processName Process name
 * @param processId Process ID
 * @param isMalicious Whether the activity is malicious
 * @param maliciousReason Reason for marking as malicious
 * @param fileHash File hash
 * @param fileContent File content
 * @returns File activity record
 */
export const createFileActivity = async (
  containerId: string,
  operation: 'create' | 'read' | 'write' | 'delete' | 'modify' | 'execute' | 'rename' | 'move',
  filePath: string,
  fileType: 'regular' | 'directory' | 'symlink' | 'device' | 'socket' | 'pipe' | 'unknown',
  fileSize: number,
  filePermissions: string,
  processName: string,
  processId: number,
  isMalicious: boolean = false,
  maliciousReason?: string,
  fileHash?: string,
  fileContent?: string
): Promise<FileActivity> => {
  try {
    return await FileActivity.create({
      id: uuidv4(),
      containerId,
      timestamp: new Date(),
      operation,
      filePath,
      fileType,
      fileSize,
      filePermissions,
      processName,
      processId,
      isMalicious,
      maliciousReason,
      fileHash,
      fileContent,
    });
  } catch (error: unknown) {
    console.error('Error creating file activity:', error);
    throw error;
  }
};

/**
 * Get file activity records by container ID
 * @param containerId Container ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns File activity records
 */
export const getFileActivityByContainerId = async (
  containerId: string,
  limit: number = 100,
  offset: number = 0
): Promise<FileActivity[]> => {
  try {
    return await FileActivity.findAll({
      where: { containerId },
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });
  } catch (error: unknown) {
    console.error('Error getting file activity by container ID:', error);
    throw error;
  }
};

/**
 * Create a process activity record
 * @param containerId Container ID
 * @param processId Process ID
 * @param parentProcessId Parent process ID
 * @param processName Process name
 * @param commandLine Command line
 * @param user User
 * @param startTime Process start time
 * @param endTime Process end time
 * @param cpuUsage CPU usage percentage
 * @param memoryUsage Memory usage in MB
 * @param status Process status
 * @param exitCode Process exit code
 * @param isMalicious Whether the activity is malicious
 * @param maliciousReason Reason for marking as malicious
 * @returns Process activity record
 */
export const createProcessActivity = async (
  containerId: string,
  processId: number,
  parentProcessId: number,
  processName: string,
  commandLine: string,
  user: string,
  startTime: Date,
  endTime: Date | null = null,
  cpuUsage: number,
  memoryUsage: number,
  status: 'running' | 'stopped' | 'terminated' | 'zombie',
  exitCode: number | null = null,
  isMalicious: boolean = false,
  maliciousReason?: string
): Promise<ProcessActivity> => {
  try {
    return await ProcessActivity.create({
      id: uuidv4(),
      containerId,
      timestamp: new Date(),
      processId,
      parentProcessId,
      processName,
      commandLine,
      user,
      startTime,
      endTime,
      cpuUsage,
      memoryUsage,
      status,
      exitCode,
      isMalicious,
      maliciousReason,
    });
  } catch (error: unknown) {
    console.error('Error creating process activity:', error);
    throw error;
  }
};

/**
 * Get process activity records by container ID
 * @param containerId Container ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Process activity records
 */
export const getProcessActivityByContainerId = async (
  containerId: string,
  limit: number = 100,
  offset: number = 0
): Promise<ProcessActivity[]> => {
  try {
    return await ProcessActivity.findAll({
      where: { containerId },
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });
  } catch (error: unknown) {
    console.error('Error getting process activity by container ID:', error);
    throw error;
  }
};

/**
 * Start monitoring a container
 * @param containerId Container ID
 * @param interval Monitoring interval in milliseconds
 * @returns Monitoring interval ID
 */
export const startContainerMonitoring = async (
  containerId: string,
  interval: number = 5000
): Promise<NodeJS.Timeout> => {
  try {
    // Check if container exists
    const containerStatus = await containerService.getContainerStatus(containerId);
    if (containerStatus === 'error') {
      throw new Error(`Container ${containerId} is in error state`);
    }

    // Start monitoring interval
    const monitoringInterval = setInterval(async () => {
      try {
        // Get container status
        const status = await containerService.getContainerStatus(containerId);
        if (status === 'stopped' || status === 'error') {
          clearInterval(monitoringInterval);
          return;
        }

        // Get container stats
        const stats = await containerService.executeCommand(containerId, 'top -bn1 && free -m && df -h');
        
        // Parse stats (simplified for example)
        const cpuUsage = Math.random() * 100; // Replace with actual parsing
        const memoryUsage = Math.floor(Math.random() * 1024); // Replace with actual parsing
        const diskUsage = Math.floor(Math.random() * 10240); // Replace with actual parsing
        const networkInbound = Math.floor(Math.random() * 10000); // Replace with actual parsing
        const networkOutbound = Math.floor(Math.random() * 10000); // Replace with actual parsing
        const processCount = Math.floor(Math.random() * 50) + 1; // Replace with actual parsing
        const openFileCount = Math.floor(Math.random() * 100) + 1; // Replace with actual parsing
        const openSocketCount = Math.floor(Math.random() * 20) + 1; // Replace with actual parsing

        // Create monitoring record
        await createContainerMonitoring(
          containerId,
          cpuUsage,
          memoryUsage,
          diskUsage,
          networkInbound,
          networkOutbound,
          processCount,
          openFileCount,
          openSocketCount
        );

        // Monitor network activity
        const netstat = await containerService.executeCommand(containerId, 'netstat -tunaep');
        // Parse netstat output and create network activity records (simplified for example)
        if (Math.random() > 0.7) { // Simulate occasional network activity
          await createNetworkActivity(
            containerId,
            'tcp',
            '192.168.1.1',
            Math.floor(Math.random() * 65535),
            '8.8.8.8',
            443,
            'outbound',
            Math.floor(Math.random() * 1024),
            Math.floor(Math.random() * 1000),
            'established',
            'chrome',
            Math.floor(Math.random() * 10000),
            false
          );
        }

        // Monitor file activity
        const lsof = await containerService.executeCommand(containerId, 'lsof');
        // Parse lsof output and create file activity records (simplified for example)
        if (Math.random() > 0.8) { // Simulate occasional file activity
          await createFileActivity(
            containerId,
            'write',
            '/tmp/test.txt',
            'regular',
            Math.floor(Math.random() * 1024),
            'rw-r--r--',
            'bash',
            Math.floor(Math.random() * 10000),
            false
          );
        }

        // Monitor process activity
        const ps = await containerService.executeCommand(containerId, 'ps -ef');
        // Parse ps output and create process activity records (simplified for example)
        if (Math.random() > 0.9) { // Simulate occasional process activity
          await createProcessActivity(
            containerId,
            Math.floor(Math.random() * 10000),
            1,
            'bash',
            'bash -c "echo hello"',
            'root',
            new Date(),
            null,
            Math.random() * 10,
            Math.floor(Math.random() * 100),
            'running',
            null,
            false
          );
        }
      } catch (error: unknown) {
        console.error('Error monitoring container:', error);
      }
    }, interval);

    return monitoringInterval;
  } catch (error: unknown) {
    console.error('Error starting container monitoring:', error);
    throw error;
  }
};

/**
 * Stop monitoring a container
 * @param monitoringInterval Monitoring interval ID
 */
export const stopContainerMonitoring = (monitoringInterval: NodeJS.Timeout): void => {
  clearInterval(monitoringInterval);
};

/**
 * Get suspicious activities for a container
 * @param containerId Container ID
 * @returns Suspicious activities
 */
export const getSuspiciousActivities = async (
  containerId: string
): Promise<{
  networkActivities: NetworkActivity[];
  fileActivities: FileActivity[];
  processActivities: ProcessActivity[];
}> => {
  try {
    // Get suspicious network activities
    const networkActivities = await NetworkActivity.findAll({
      where: { containerId, isMalicious: true },
      order: [['timestamp', 'DESC']],
    });

    // Get suspicious file activities
    const fileActivities = await FileActivity.findAll({
      where: { containerId, isMalicious: true },
      order: [['timestamp', 'DESC']],
    });

    // Get suspicious process activities
    const processActivities = await ProcessActivity.findAll({
      where: { containerId, isMalicious: true },
      order: [['timestamp', 'DESC']],
    });

    return {
      networkActivities,
      fileActivities,
      processActivities,
    };
  } catch (error: unknown) {
    console.error('Error getting suspicious activities:', error);
    throw error;
  }
};

/**
 * Get container monitoring summary
 * @param containerId Container ID
 * @returns Container monitoring summary
 */
export const getContainerMonitoringSummary = async (
  containerId: string
): Promise<{
  averageCpuUsage: number;
  averageMemoryUsage: number;
  totalNetworkInbound: number;
  totalNetworkOutbound: number;
  totalFileOperations: number;
  totalProcesses: number;
  suspiciousActivityCount: number;
}> => {
  try {
    // Get container monitoring records
    const monitorings = await ContainerMonitoring.findAll({
      where: { containerId },
    });

    // Calculate average CPU usage
    const averageCpuUsage = monitorings.reduce((sum, monitoring) => sum + monitoring.cpuUsage, 0) / monitorings.length;

    // Calculate average memory usage
    const averageMemoryUsage = monitorings.reduce((sum, monitoring) => sum + monitoring.memoryUsage, 0) / monitorings.length;

    // Calculate total network inbound
    const totalNetworkInbound = monitorings.reduce((sum, monitoring) => sum + monitoring.networkInbound, 0);

    // Calculate total network outbound
    const totalNetworkOutbound = monitorings.reduce((sum, monitoring) => sum + monitoring.networkOutbound, 0);

    // Get file activities
    const fileActivities = await FileActivity.findAll({
      where: { containerId },
    });

    // Get process activities
    const processActivities = await ProcessActivity.findAll({
      where: { containerId },
    });

    // Get suspicious activities
    const suspiciousActivities = await getSuspiciousActivities(containerId);
    const suspiciousActivityCount = 
      suspiciousActivities.networkActivities.length + 
      suspiciousActivities.fileActivities.length + 
      suspiciousActivities.processActivities.length;

    return {
      averageCpuUsage,
      averageMemoryUsage,
      totalNetworkInbound,
      totalNetworkOutbound,
      totalFileOperations: fileActivities.length,
      totalProcesses: processActivities.length,
      suspiciousActivityCount,
    };
  } catch (error: unknown) {
    console.error('Error getting container monitoring summary:', error);
    throw error;
  }
};
