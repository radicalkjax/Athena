// Mock container database service for testing
export const createContainer = jest.fn().mockResolvedValue({
  id: 'mock-container-123',
  status: 'running',
  malwareId: 'test-malware-123',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const getContainer = jest.fn().mockResolvedValue({
  id: 'mock-container-123',
  status: 'running',
  malwareId: 'test-malware-123',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const updateContainerStatus = jest.fn().mockResolvedValue({
  id: 'mock-container-123',
  status: 'stopped',
  malwareId: 'test-malware-123',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const getContainersByMalware = jest.fn().mockResolvedValue([
  {
    id: 'mock-container-123',
    status: 'running',
    malwareId: 'test-malware-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

export const saveContainerConfiguration = jest.fn().mockResolvedValue(true);
export const getContainerConfiguration = jest.fn().mockResolvedValue({
  os: 'linux',
  resourcePreset: 'standard',
  cpuCores: 2,
  memoryGB: 4,
  diskGB: 20,
  networkIsolation: true,
});

export const saveContainerMonitoring = jest.fn().mockResolvedValue(true);
export const getContainerMonitoring = jest.fn().mockResolvedValue({
  cpuUsage: 45.2,
  memoryUsage: 1024,
  diskUsage: 2048,
  networkActivity: [],
});

export const saveProcessActivity = jest.fn().mockResolvedValue(true);
export const getProcessActivities = jest.fn().mockResolvedValue([]);

export const saveNetworkActivity = jest.fn().mockResolvedValue(true);
export const getNetworkActivities = jest.fn().mockResolvedValue([]);

export const saveFileActivity = jest.fn().mockResolvedValue(true);
export const getFileActivities = jest.fn().mockResolvedValue([]);