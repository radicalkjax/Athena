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
  totalMemory: 4 * 1024 * 1024 * 1024, // 4GB
  osInternalBuildId: 'mock-build-id',
  
  // Mock functions
  getDeviceTypeAsync: jest.fn().mockResolvedValue(1), // PHONE by default // eslint-disable-line no-undef
  
  // Reset function for tests
  _reset: () => {
    mockDevice.isDevice = true;
    mockDevice.totalMemory = 4 * 1024 * 1024 * 1024;
    mockDevice.osInternalBuildId = 'mock-build-id';
    mockDevice.getDeviceTypeAsync.mockClear();
    mockDevice.getDeviceTypeAsync.mockResolvedValue(1);
  }
};

// Initialize with default implementations
mockDevice._reset();

module.exports = mockDevice;