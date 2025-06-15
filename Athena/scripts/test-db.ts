import { initializeDatabase, createContainerConfig, createContainer, getAllContainers, getAllContainerConfigs } from '../services/database';
import { OSType, ArchitectureType } from '@/types';

/**
 * Test the database implementation
 */
const testDatabase = async () => {
  try {
    console.log('Testing database implementation...');
    
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Create container configurations for each OS
    console.log('\nCreating container configurations...');
    
    // Windows container config
    const windowsConfig = await createContainerConfig(
      {
        os: 'windows' as OSType,
        architecture: 'x64' as ArchitectureType,
        version: 'windows-10',
        imageTag: 'windows-10-x64:latest',
      },
      {
        cpu: 2,
        memory: 4096,
        diskSpace: 10240,
        networkSpeed: 20,
        ioOperations: 2000,
      },
      {
        readOnlyRootFilesystem: true,
        noNewPrivileges: true,
        seccomp: true,
        appArmor: true,
        addressSpaceLayoutRandomization: true,
        windowsDefender: true,
        memoryProtection: true,
        controlFlowGuard: true,
        dataExecutionPrevention: true,
        secureBootEnabled: true,
        hypervisorEnforced: true,
      }
    );
    console.log('Windows container config created:', windowsConfig.id);
    
    // Linux container config
    const linuxConfig = await createContainerConfig(
      {
        os: 'linux' as OSType,
        architecture: 'x64' as ArchitectureType,
        version: 'ubuntu-22.04',
        imageTag: 'ubuntu-22.04-x64:latest',
        distribution: 'ubuntu',
      },
      {
        cpu: 1,
        memory: 2048,
        diskSpace: 5120,
        networkSpeed: 10,
        ioOperations: 1000,
      },
      {
        readOnlyRootFilesystem: true,
        noNewPrivileges: true,
        seccomp: true,
        appArmor: true,
        addressSpaceLayoutRandomization: true,
        selinux: true,
        capabilities: 'drop-all',
        seccompProfile: 'default',
        privileged: false,
        namespaceIsolation: true,
        cgroupsV2: true,
        restrictSysctls: true,
      }
    );
    console.log('Linux container config created:', linuxConfig.id);
    
    // macOS container config
    const macosConfig = await createContainerConfig(
      {
        os: 'macos' as OSType,
        architecture: 'arm64' as ArchitectureType,
        version: 'macos-14',
        imageTag: 'macos-14-arm64:latest',
      },
      {
        cpu: 4,
        memory: 8192,
        diskSpace: 20480,
        networkSpeed: 40,
        ioOperations: 4000,
      },
      {
        readOnlyRootFilesystem: true,
        noNewPrivileges: true,
        seccomp: true,
        appArmor: true,
        addressSpaceLayoutRandomization: true,
        sandboxProfile: 'strict',
        transparencyConsent: true,
        systemIntegrityProtection: true,
        gatekeeper: true,
        xpcSecurity: true,
        appSandbox: true,
        fileQuarantine: true,
        libraryValidation: true,
      }
    );
    console.log('macOS container config created:', macosConfig.id);
    
    // Create containers
    console.log('\nCreating containers...');
    
    // Windows container
    const windowsContainer = await createContainer({
      status: 'creating',
      malwareId: 'malware-windows-123',
      os: 'windows' as OSType,
      architecture: 'x64' as ArchitectureType,
      version: 'windows-10',
      imageTag: 'windows-10-x64:latest',
      configId: windowsConfig.id,
    });
    console.log('Windows container created:', windowsContainer.id);
    
    // Linux container
    const linuxContainer = await createContainer({
      status: 'running',
      malwareId: 'malware-linux-456',
      os: 'linux' as OSType,
      architecture: 'x64' as ArchitectureType,
      version: 'ubuntu-22.04',
      imageTag: 'ubuntu-22.04-x64:latest',
      distribution: 'ubuntu',
      configId: linuxConfig.id,
    });
    console.log('Linux container created:', linuxContainer.id);
    
    // macOS container
    const macosContainer = await createContainer({
      status: 'stopped',
      malwareId: 'malware-macos-789',
      os: 'macos' as OSType,
      architecture: 'arm64' as ArchitectureType,
      version: 'macos-14',
      imageTag: 'macos-14-arm64:latest',
      configId: macosConfig.id,
    });
    console.log('macOS container created:', macosContainer.id);
    
    // Get all container configurations
    console.log('\nGetting all container configurations...');
    const configs = await getAllContainerConfigs();
    console.log(`Found ${configs.length} container configurations:`);
    configs.forEach((config, index) => {
      console.log(`${index + 1}. ${config.os} ${config.architecture} ${config.version}`);
    });
    
    // Get all containers
    console.log('\nGetting all containers...');
    const containers = await getAllContainers();
    console.log(`Found ${containers.length} containers:`);
    containers.forEach((container, index) => {
      console.log(`${index + 1}. ${container.os} ${container.architecture} ${container.version} (${container.status})`);
    });
    
    console.log('\nDatabase test completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    console.error('Error testing database:', error);
    process.exit(1);
  }
};

// Run the test
testDatabase();
