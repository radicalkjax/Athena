import { 
  createMacOSContainer, 
  getAvailableMacOSArchitectures, 
  getAvailableMacOSVersions,
  getContainerStatus,
  executeCommand,
  runMalwareAnalysis,
  removeContainer
} from '../services/container';
import { ArchitectureType, MacOSVersion } from '@/types';
import * as FileSystem from 'expo-file-system';

/**
 * Example of using macOS containers with different architectures and versions
 */
async function macOSContainerExample() {
  try {
    // 1. Get available macOS architectures
    const architectures = getAvailableMacOSArchitectures();
    console.log('Available macOS architectures:', architectures);

    // 2. Get available macOS versions for x64 architecture
    const x64Versions = getAvailableMacOSVersions('x64');
    console.log('Available macOS versions for x64:', x64Versions);

    // 3. Get available macOS versions for arm64 architecture
    const arm64Versions = getAvailableMacOSVersions('arm64');
    console.log('Available macOS versions for arm64:', arm64Versions);

    // 4. Read a sample malware file (for demonstration purposes)
    // In a real application, this would be a file uploaded by the user
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 5. Create a macOS container with specific architecture and version
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'arm64';
    const version: MacOSVersion = 'macos-14'; // Sonoma
    
    console.log(`Creating macOS ${version} container with ${architecture} architecture...`);
    const container = await createMacOSContainer(
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
    console.error('Error in macOS container example:', error);
    throw error;
  }
}

/**
 * Example of creating containers with different macOS versions
 */
async function createMultiVersionContainers() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'arm64';
    
    // Get available macOS versions for arm64
    const versions = getAvailableMacOSVersions(architecture);
    const containers = [];
    
    // Create a container for each macOS version
    for (const version of versions) {
      console.log(`Creating macOS container for ${version} with ${architecture} architecture...`);
      
      const container = await createMacOSContainer(
        malwareId,
        malwareBase64,
        malwareName,
        architecture,
        version
      );
      
      containers.push({
        version,
        container
      });
      
      console.log(`Container created for ${version}:`, container);
    }
    
    // Clean up - remove all containers
    for (const item of containers) {
      console.log(`Removing container for ${item.version}...`);
      await removeContainer(item.container.id);
    }
    
    return containers;
  } catch (error) {
    console.error('Error creating multi-version containers:', error);
    throw error;
  }
}

/**
 * Example of comparing malware behavior across different macOS versions
 */
async function compareMacOSVersions() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const architecture: ArchitectureType = 'arm64';
    
    // Create containers for different macOS versions
    const testEnvironments = [
      { version: 'macos-12' as MacOSVersion, architecture }, // Monterey
      { version: 'macos-13' as MacOSVersion, architecture }, // Ventura
      { version: 'macos-14' as MacOSVersion, architecture }  // Sonoma
    ];
    
    const results = [];
    
    for (const env of testEnvironments) {
      console.log(`Creating container for macOS ${env.version}...`);
      
      // Create container
      const container = await createMacOSContainer(
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
        console.error(`Container creation failed for macOS ${env.version}`);
        continue;
      }
      
      // Run analysis
      console.log(`Running analysis on macOS ${env.version}...`);
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
    console.log('Comparison of malware behavior across macOS versions:');
    for (const result of results) {
      console.log(`\nmacOS ${result.environment.version}:`);
      console.log(`- Network activity: ${result.analysisResult.networkActivity.length} events`);
      console.log(`- File activity: ${result.analysisResult.fileActivity.length} events`);
    }
    
    return results;
  } catch (error) {
    console.error('Error comparing macOS versions:', error);
    throw error;
  }
}

/**
 * Example of comparing malware behavior across different architectures
 */
async function compareArchitectures() {
  try {
    // Sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    const version: MacOSVersion = 'macos-14'; // Sonoma
    
    // Create containers for different architectures
    const testEnvironments = [
      { architecture: 'x64' as ArchitectureType, version },
      { architecture: 'arm64' as ArchitectureType, version }
    ];
    
    const results = [];
    
    for (const env of testEnvironments) {
      console.log(`Creating container for macOS ${env.version} on ${env.architecture}...`);
      
      // Create container
      const container = await createMacOSContainer(
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
        console.error(`Container creation failed for ${env.architecture}`);
        continue;
      }
      
      // Run analysis
      console.log(`Running analysis on ${env.architecture}...`);
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
    console.log('Comparison of malware behavior across architectures:');
    for (const result of results) {
      console.log(`\n${result.environment.architecture}:`);
      console.log(`- Network activity: ${result.analysisResult.networkActivity.length} events`);
      console.log(`- File activity: ${result.analysisResult.fileActivity.length} events`);
    }
    
    return results;
  } catch (error) {
    console.error('Error comparing architectures:', error);
    throw error;
  }
}

export {
  macOSContainerExample,
  createMultiVersionContainers,
  compareMacOSVersions,
  compareArchitectures
};
