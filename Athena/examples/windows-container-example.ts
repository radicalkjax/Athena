import { 
  createWindowsContainer, 
  getAvailableWindowsArchitectures, 
  getAvailableWindowsVersions,
  getContainerStatus,
  executeCommand,
  runMalwareAnalysis,
  removeContainer
} from '../services/container';
import { ArchitectureType } from '@/types';
import * as FileSystem from 'expo-file-system';

/**
 * Example of using Windows containers with different architectures
 */
async function windowsContainerExample() {
  try {
    // 1. Get available Windows architectures
    const architectures = getAvailableWindowsArchitectures();
    console.log('Available Windows architectures:', architectures);

    // 2. Get available Windows versions for x64 architecture
    const x64Versions = getAvailableWindowsVersions('x64');
    console.log('Available Windows versions for x64:', x64Versions);

    // 3. Read a sample malware file (for demonstration purposes)
    // In a real application, this would be a file uploaded by the user
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 4. Create a Windows container with specific architecture and version
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'x64';
    const version = 'windows-10';
    
    console.log(`Creating Windows ${version} container with ${architecture} architecture...`);
    const container = await createWindowsContainer(
      malwareId,
      malwareBase64,
      malwareName,
      architecture,
      version
    );
    
    console.log('Container created:', container);
    
    // 5. Wait for the container to be ready
    let status = await getContainerStatus(container.id);
    console.log('Initial container status:', status);
    
    while (status === 'creating') {
      // Wait for 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await getContainerStatus(container.id);
      console.log('Container status:', status);
    }
    
    if (status === 'error') {
      throw new Error('Container creation failed');
    }
    
    // 6. Execute a command in the container
    console.log('Executing command in container...');
    const commandResult = await executeCommand(container.id, 'dir C:\\');
    console.log('Command output:', commandResult.output);
    
    // 7. Run malware analysis
    console.log('Running malware analysis...');
    const analysisResult = await runMalwareAnalysis(container.id, 120); // 2 minute timeout
    
    console.log('Analysis logs:', analysisResult.logs);
    console.log('Network activity:', analysisResult.networkActivity);
    console.log('File activity:', analysisResult.fileActivity);
    
    // 8. Clean up - remove the container
    console.log('Removing container...');
    const removed = await removeContainer(container.id);
    console.log('Container removed:', removed);
    
    return {
      container,
      analysisResult
    };
  } catch (error: unknown) {
    console.error('Error in Windows container example:', error);
    throw error;
  }
}

// Example of creating containers with different architectures
async function createMultiArchContainers() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    
    // Create containers for different architectures
    const architectures: ArchitectureType[] = ['x86', 'x64', 'arm64'];
    const containers = [];
    
    for (const architecture of architectures) {
      console.log(`Creating Windows container with ${architecture} architecture...`);
      
      // Get available versions for this architecture
      const versions = getAvailableWindowsVersions(architecture);
      
      // Use the latest Windows version available for this architecture
      const latestVersion = versions[versions.length - 1];
      
      const container = await createWindowsContainer(
        malwareId,
        malwareBase64,
        malwareName,
        architecture,
        latestVersion
      );
      
      containers.push({
        architecture,
        version: latestVersion,
        container
      });
      
      console.log(`Container created for ${architecture}:`, container);
    }
    
    // Clean up - remove all containers
    for (const item of containers) {
      console.log(`Removing container for ${item.architecture}...`);
      await removeContainer(item.container.id);
    }
    
    return containers;
  } catch (error: unknown) {
    console.error('Error creating multi-arch containers:', error);
    throw error;
  }
}

export {
  windowsContainerExample,
  createMultiArchContainers
};
