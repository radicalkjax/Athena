import { 
  createLinuxContainer, 
  getAvailableLinuxArchitectures, 
  getAvailableLinuxVersions,
  getAvailableLinuxDistributions,
  getContainerStatus,
  executeCommand,
  runMalwareAnalysis,
  removeContainer
} from '../services/container';
import { ArchitectureType, LinuxVersion } from '@/types';
import * as FileSystem from 'expo-file-system';

/**
 * Example of using Linux containers with different architectures and distributions
 */
async function linuxContainerExample() {
  try {
    // 1. Get available Linux architectures
    const architectures = getAvailableLinuxArchitectures();
    console.log('Available Linux architectures:', architectures);

    // 2. Get available Linux distributions
    const distributions = getAvailableLinuxDistributions();
    console.log('Available Linux distributions:', distributions);

    // 3. Get available Linux versions for x64 architecture
    const x64Versions = getAvailableLinuxVersions('x64');
    console.log('Available Linux versions for x64:', x64Versions);

    // 4. Read a sample malware file (for demonstration purposes)
    // In a real application, this would be a file uploaded by the user
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 5. Create a Linux container with specific architecture and version
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'x64';
    const version: LinuxVersion = 'ubuntu-22.04';
    
    console.log(`Creating Linux ${version} container with ${architecture} architecture...`);
    const container = await createLinuxContainer(
      malwareId,
      malwareBase64,
      malwareName,
      architecture,
      version
    );
    
    console.log('Container created:', container);
    
    // 6. Wait for the container to be ready
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
    
    // 7. Execute a command in the container
    console.log('Executing command in container...');
    const commandResult = await executeCommand(container.id, 'ls -la /');
    console.log('Command output:', commandResult.output);
    
    // 8. Run malware analysis
    console.log('Running malware analysis...');
    const analysisResult = await runMalwareAnalysis(container.id, 120); // 2 minute timeout
    
    console.log('Analysis logs:', analysisResult.logs);
    console.log('Network activity:', analysisResult.networkActivity);
    console.log('File activity:', analysisResult.fileActivity);
    
    // 9. Clean up - remove the container
    console.log('Removing container...');
    const removed = await removeContainer(container.id);
    console.log('Container removed:', removed);
    
    return {
      container,
      analysisResult
    };
  } catch (error) {
    console.error('Error in Linux container example:', error);
    throw error;
  }
}

// Example of creating containers with different Linux distributions
async function createMultiDistroContainers() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'x64';
    
    // Get available Linux distributions
    const distributions = getAvailableLinuxDistributions();
    const containers = [];
    
    // Create a container for each distribution using the latest version
    for (const distribution of distributions) {
      // Get versions for this distribution
      const allVersions = getAvailableLinuxVersions(architecture);
      const distroVersions = allVersions.filter(v => v.startsWith(distribution));
      
      // Use the latest version for this distribution
      const latestVersion = distroVersions[distroVersions.length - 1] as LinuxVersion;
      
      console.log(`Creating Linux container for ${distribution} (${latestVersion})...`);
      
      const container = await createLinuxContainer(
        malwareId,
        malwareBase64,
        malwareName,
        architecture,
        latestVersion
      );
      
      containers.push({
        distribution,
        version: latestVersion,
        container
      });
      
      console.log(`Container created for ${distribution}:`, container);
    }
    
    // Clean up - remove all containers
    for (const item of containers) {
      console.log(`Removing container for ${item.distribution}...`);
      await removeContainer(item.container.id);
    }
    
    return containers;
  } catch (error) {
    console.error('Error creating multi-distro containers:', error);
    throw error;
  }
}

// Example of comparing malware behavior across different Linux distributions
async function compareMalwareBehavior() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    
    // Create containers for different Linux distributions
    const testEnvironments = [
      { distribution: 'ubuntu', version: 'ubuntu-22.04' as LinuxVersion, architecture: 'x64' as ArchitectureType },
      { distribution: 'debian', version: 'debian-11' as LinuxVersion, architecture: 'x64' as ArchitectureType },
      { distribution: 'alpine', version: 'alpine-3.18' as LinuxVersion, architecture: 'x64' as ArchitectureType }
    ];
    
    const results = [];
    
    for (const env of testEnvironments) {
      console.log(`Creating container for ${env.distribution} ${env.version}...`);
      
      // Create container
      const container = await createLinuxContainer(
        malwareId,
        malwareBase64,
        malwareName,
        env.architecture,
        env.version
      );
      
      // Wait for container to be ready
      let status = await getContainerStatus(container.id);
      while (status === 'creating') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        status = await getContainerStatus(container.id);
      }
      
      if (status === 'error') {
        console.error(`Container creation failed for ${env.distribution}`);
        continue;
      }
      
      // Run analysis
      console.log(`Running analysis on ${env.distribution}...`);
      const analysisResult = await runMalwareAnalysis(container.id, 120);
      
      // Store results
      results.push({
        environment: env,
        container,
        analysisResult
      });
      
      // Clean up
      await removeContainer(container.id);
    }
    
    // Compare results
    console.log('Comparison of malware behavior across Linux distributions:');
    for (const result of results) {
      console.log(`\n${result.environment.distribution} ${result.environment.version}:`);
      console.log(`- Network activity: ${result.analysisResult.networkActivity.length} events`);
      console.log(`- File activity: ${result.analysisResult.fileActivity.length} events`);
    }
    
    return results;
  } catch (error) {
    console.error('Error comparing malware behavior:', error);
    throw error;
  }
}

export {
  linuxContainerExample,
  createMultiDistroContainers,
  compareMalwareBehavior
};
