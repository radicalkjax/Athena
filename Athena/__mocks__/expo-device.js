// Mock for expo-device
/* global jest */
const mockDevice = {
  // Device type enum
  DeviceType: {
    UNKNOWN: 0,
    PHONE: 1,
    TABLET: 2,
    DESKTOP: 3,
    TV: 4
  },
  
  // Default mock values
  isDevice: true,
  totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
  osInternalBuildId: 'mock-build-id',
  
  // Mock functions
  getDeviceTypeAsync: async () => 1, // PHONE by default
  
  // Reset function for tests
  _reset: () => {
    mockDevice.isDevice = true;
    mockDevice.totalMemory = 8 * 1024 * 1024 * 1024; // Keep consistent with initial value
    mockDevice.osInternalBuildId = 'mock-build-id';
  }
};

// Initialize with default implementations
mockDevice._reset();

module.exports = mockDevice;