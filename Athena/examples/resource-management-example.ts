import { 
  createWindowsContainer, 
  createLinuxContainer, 
  createMacOSContainer,
  getResourcePreset,
  createResourceLimits,
  getContainerStatus,
  executeCommand,
  runMalwareAnalysis,
  removeContainer
} from '../services/container';
import { ArchitectureType } from '@/types';
import * as FileSystem from 'expo-file-system';

/**
 * Example of creating containers with different resource presets
 */
async function resourcePresetsExample() {
  try {
    // Read a sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    
    // 1. Create a Windows container with minimal resources
    console.log('Creating Windows container with minimal resources...');
    const minimalResources = getResourcePreset('minimal');
    console.log('Minimal resource configuration:', minimalResources);
    
    const windowsContainer = await createWindowsContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'x64',
      'windows-10',
      minimalResources
    );
    
    console.log('Windows container created with minimal resources:', windowsContainer);
    
    // 2. Create a Linux container with standard resources
    console.log('Creating Linux container with standard resources...');
    const standardResources = getResourcePreset('standard');
    console.log('Standard resource configuration:', standardResources);
    
    const linuxContainer = await createLinuxContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'x64',
      'ubuntu-22.04',
      standardResources
    );
    
    console.log('Linux container created with standard resources:', linuxContainer);
    
    // 3. Create a macOS container with performance resources
    console.log('Creating macOS container with performance resources...');
    const performanceResources = getResourcePreset('performance');
    console.log('Performance resource configuration:', performanceResources);
    
    const macOSContainer = await createMacOSContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'arm64',
      'macos-14',
      performanceResources
    );
    
    console.log('macOS container created with performance resources:', macOSContainer);
    
    // 4. Create a Windows container with intensive resources
    console.log('Creating Windows container with intensive resources...');
    const intensiveResources = getResourcePreset('intensive');
    console.log('Intensive resource configuration:', intensiveResources);
    
    const windowsContainer2 = await createWindowsContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'x64',
      'windows-11',
      intensiveResources
    );
    
    console.log('Windows container created with intensive resources:', windowsContainer2);
    
    // Clean up - remove all containers
    await removeContainer(windowsContainer.id);
    await removeContainer(linuxContainer.id);
    await removeContainer(macOSContainer.id);
    await removeContainer(windowsContainer2.id);
    
    return {
      windowsContainer,
      linuxContainer,
      macOSContainer,
      windowsContainer2
    };
  } catch (error: unknown) {
    console.error('Error in resource presets example:', error);
    throw error;
  }
}

/**
 * Example of creating containers with custom resource limits
 */
async function customResourceLimitsExample() {
  try {
    // Read a sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    
    // 1. Create a Windows container with custom resources
    console.log('Creating Windows container with custom resources...');
    const customWindowsResources = createResourceLimits(
      2,      // 2 CPU cores
      4096,   // 4 GB RAM
      8192,   // 8 GB disk space
      20,     // 20 Mbps network speed
      2000    // 2000 IOPS
    );
    console.log('Custom Windows resource configuration:', customWindowsResources);
    
    const windowsContainer = await createWindowsContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'x64',
      'windows-10',
      customWindowsResources
    );
    
    console.log('Windows container created with custom resources:', windowsContainer);
    
    // 2. Create a Linux container with custom resources
    console.log('Creating Linux container with custom resources...');
    const customLinuxResources = createResourceLimits(
      1.5,    // 1.5 CPU cores
      3072,   // 3 GB RAM
      10240,  // 10 GB disk space
      15,     // 15 Mbps network speed
      1500    // 1500 IOPS
    );
    console.log('Custom Linux resource configuration:', customLinuxResources);
    
    const linuxContainer = await createLinuxContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'x64',
      'ubuntu-22.04',
      customLinuxResources
    );
    
    console.log('Linux container created with custom resources:', linuxContainer);
    
    // 3. Create a macOS container with custom resources
    console.log('Creating macOS container with custom resources...');
    const customMacOSResources = createResourceLimits(
      3,      // 3 CPU cores
      6144,   // 6 GB RAM
      15360,  // 15 GB disk space
      30,     // 30 Mbps network speed
      3000    // 3000 IOPS
    );
    console.log('Custom macOS resource configuration:', customMacOSResources);
    
    const macOSContainer = await createMacOSContainer(
      malwareId,
      malwareBase64,
      malwareName,
      'arm64',
      'macos-14',
      customMacOSResources
    );
    
    console.log('macOS container created with custom resources:', macOSContainer);
    
    // Clean up - remove all containers
    await removeContainer(windowsContainer.id);
    await removeContainer(linuxContainer.id);
    await removeContainer(macOSContainer.id);
    
    return {
      windowsContainer,
      linuxContainer,
      macOSContainer
    };
  } catch (error: unknown) {
    console.error('Error in custom resource limits example:', error);
    throw error;
  }
}

/**
 * Example of analyzing malware with different resource configurations
 */
async function resourcePerformanceComparisonExample() {
  try {
    // Read a sample malware file (for demonstration purposes)
    const malwareUri = `${FileSystem.documentDirectory}sample-malware.bin`;
    const malwareBase64 = await FileSystem.readAsStringAsync(malwareUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const malwareId = 'sample-malware-001';
    const malwareName = 'sample-malware.bin';
    
    // Create containers with different resource configurations
    const resourceConfigurations = [
      { name: 'Minimal', preset: 'minimal' },
      { name: 'Standard', preset: 'standard' },
      { name: 'Performance', preset: 'performance' },
      { name: 'Intensive', preset: 'intensive' }
    ];
    
    const results = [];
    
    for (const config of resourceConfigurations) {
      console.log(`Creating container with ${config.name} resources...`);
      const resources = getResourcePreset(config.preset as any);
      
      // Create a Windows container with the specified resources
      const container = await createWindowsContainer(
        malwareId,
        malwareBase64,
        malwareName,
        'x64',
        'windows-10',
        resources
      );
      
      // Wait for the container to be ready
      let status = await getContainerStatus(container.id);
      while (status === 'creating') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        status = await getContainerStatus(container.id);
      }
      
      if (status === 'error') {
        console.error(`Container creation failed for ${config.name} resources`);
        continue;
      }
      
      // Run analysis and measure time
      console.log(`Running analysis with ${config.name} resources...`);
      const startTime = Date.now();
      const analysisResult = await runMalwareAnalysis(container.id, 120);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Store results
      results.push({
        resourceConfig: config.name,
        resources,
        duration,
        networkActivityCount: analysisResult.networkActivity.length,
        fileActivityCount: analysisResult.fileActivity.length,
        container
      });
      
      // Clean up
      await removeContainer(container.id);
    }
    
    // Compare results
    console.log('Resource Performance Comparison:');
    console.log('--------------------------------');
    
    results.forEach(result => {
      console.log(`\n${result.resourceConfig} Resources:`);
      console.log(`- CPU: ${result.resources.cpu} cores`);
      console.log(`- Memory: ${result.resources.memory} MB`);
      console.log(`- Disk Space: ${result.resources.diskSpace} MB`);
      console.log(`- Network Speed: ${result.resources.networkSpeed} Mbps`);
      console.log(`- I/O Operations: ${result.resources.ioOperations} IOPS`);
      console.log(`- Analysis Duration: ${result.duration} ms`);
      console.log(`- Network Activity: ${result.networkActivityCount} events`);
      console.log(`- File Activity: ${result.fileActivityCount} events`);
    });
    
    return results;
  } catch (error: unknown) {
    console.error('Error in resource performance comparison example:', error);
    throw error;
  }
}

export {
  resourcePresetsExample,
  customResourceLimitsExample,
  resourcePerformanceComparisonExample
};
