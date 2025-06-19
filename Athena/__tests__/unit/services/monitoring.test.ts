import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createContainerMonitoring,
  getContainerMonitoringByContainerId,
  createNetworkActivity,
  getNetworkActivityByContainerId,
  createFileActivity,
  getFileActivityByContainerId,
  createProcessActivity,
  getProcessActivityByContainerId,
  startContainerMonitoring,
  stopContainerMonitoring,
  getSuspiciousActivities,
  getContainerMonitoringSummary
} from '@/services/monitoring';
import * as containerService from '@/services/container';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
vi.mock('uuid');
vi.mock('@/services/container');
vi.mock('@/models', () => ({
  ContainerMonitoring: {
    create: vi.fn(),
    findAll: vi.fn()
  },
  NetworkActivity: {
    create: vi.fn(),
    findAll: vi.fn()
  },
  FileActivity: {
    create: vi.fn(),
    findAll: vi.fn()
  },
  ProcessActivity: {
    create: vi.fn(),
    findAll: vi.fn()
  }
}));

// Import mocked models after mocking
import { ContainerMonitoring, NetworkActivity, FileActivity, ProcessActivity } from '@/models';

const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockContainerService = containerService as jest.Mocked<typeof containerService>;

describe('Monitoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUuidv4.mockReturnValue('test-uuid');
  });

  describe('createContainerMonitoring', () => {
    it('should create container monitoring record', async () => {
      const mockRecord = {
        id: 'test-uuid',
        containerId: 'container-123',
        timestamp: expect.any(Date),
        cpuUsage: 50,
        memoryUsage: 512,
        diskUsage: 1024,
        networkInbound: 1000,
        networkOutbound: 2000,
        processCount: 10,
        openFileCount: 20,
        openSocketCount: 5,
        suspiciousActivities: []
      };

      (ContainerMonitoring.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await createContainerMonitoring(
        'container-123',
        50,
        512,
        1024,
        1000,
        2000,
        10,
        20,
        5
      );

      expect(result).toEqual(mockRecord);
      expect(ContainerMonitoring.create).toHaveBeenCalledWith({
        id: 'test-uuid',
        containerId: 'container-123',
        timestamp: expect.any(Date),
        cpuUsage: 50,
        memoryUsage: 512,
        diskUsage: 1024,
        networkInbound: 1000,
        networkOutbound: 2000,
        processCount: 10,
        openFileCount: 20,
        openSocketCount: 5,
        suspiciousActivities: []
      });
    });

    it('should handle suspicious activities', async () => {
      const suspiciousActivities = ['Port scan detected', 'Crypto mining attempt'];
      
      (ContainerMonitoring.create as jest.Mock).mockResolvedValue({
        id: 'test-uuid',
        suspiciousActivities
      });

      await createContainerMonitoring(
        'container-123',
        50, 512, 1024, 1000, 2000, 10, 20, 5,
        suspiciousActivities
      );

      expect(ContainerMonitoring.create).toHaveBeenCalledWith(
        expect.objectContaining({
          suspiciousActivities
        })
      );
    });

    it('should throw error if creation fails', async () => {
      (ContainerMonitoring.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(createContainerMonitoring(
        'container-123',
        50, 512, 1024, 1000, 2000, 10, 20, 5
      )).rejects.toThrow('Database error');
    });
  });

  describe('getContainerMonitoringByContainerId', () => {
    it('should get monitoring records by container ID', async () => {
      const mockRecords = [
        { id: '1', containerId: 'container-123', timestamp: new Date() },
        { id: '2', containerId: 'container-123', timestamp: new Date() }
      ];

      (ContainerMonitoring.findAll as jest.Mock).mockResolvedValue(mockRecords);

      const result = await getContainerMonitoringByContainerId('container-123');

      expect(result).toEqual(mockRecords);
      expect(ContainerMonitoring.findAll).toHaveBeenCalledWith({
        where: { containerId: 'container-123' },
        limit: 100,
        offset: 0,
        order: [['timestamp', 'DESC']]
      });
    });

    it('should support pagination', async () => {
      (ContainerMonitoring.findAll as jest.Mock).mockResolvedValue([]);

      await getContainerMonitoringByContainerId('container-123', 50, 10);

      expect(ContainerMonitoring.findAll).toHaveBeenCalledWith({
        where: { containerId: 'container-123' },
        limit: 50,
        offset: 10,
        order: [['timestamp', 'DESC']]
      });
    });
  });

  describe('createNetworkActivity', () => {
    it('should create network activity record', async () => {
      const mockRecord = {
        id: 'test-uuid',
        containerId: 'container-123',
        timestamp: expect.any(Date),
        protocol: 'tcp',
        sourceIp: '192.168.1.1',
        sourcePort: 5000,
        destinationIp: '8.8.8.8',
        destinationPort: 443,
        direction: 'outbound',
        dataSize: 1024,
        duration: 500,
        status: 'established',
        processName: 'chrome',
        processId: 1234,
        isMalicious: false,
        maliciousReason: undefined,
        payload: undefined
      };

      (NetworkActivity.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await createNetworkActivity(
        'container-123',
        'tcp',
        '192.168.1.1',
        5000,
        '8.8.8.8',
        443,
        'outbound',
        1024,
        500,
        'established',
        'chrome',
        1234
      );

      expect(result).toEqual(mockRecord);
      expect(NetworkActivity.create).toHaveBeenCalledWith({
        id: 'test-uuid',
        containerId: 'container-123',
        timestamp: expect.any(Date),
        protocol: 'tcp',
        sourceIp: '192.168.1.1',
        sourcePort: 5000,
        destinationIp: '8.8.8.8',
        destinationPort: 443,
        direction: 'outbound',
        dataSize: 1024,
        duration: 500,
        status: 'established',
        processName: 'chrome',
        processId: 1234,
        isMalicious: false,
        maliciousReason: undefined,
        payload: undefined
      });
    });

    it('should handle malicious activity', async () => {
      (NetworkActivity.create as jest.Mock).mockResolvedValue({
        id: 'test-uuid',
        isMalicious: true,
        maliciousReason: 'Known C2 server'
      });

      await createNetworkActivity(
        'container-123',
        'tcp',
        '192.168.1.1',
        5000,
        '10.0.0.1',
        4444,
        'outbound',
        1024,
        500,
        'established',
        'malware.exe',
        1234,
        true,
        'Known C2 server',
        'encrypted payload'
      );

      expect(NetworkActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isMalicious: true,
          maliciousReason: 'Known C2 server',
          payload: 'encrypted payload'
        })
      );
    });
  });

  describe('createFileActivity', () => {
    it('should create file activity record', async () => {
      const mockRecord = {
        id: 'test-uuid',
        containerId: 'container-123',
        timestamp: expect.any(Date),
        operation: 'write',
        filePath: '/tmp/test.txt',
        fileType: 'regular',
        fileSize: 1024,
        filePermissions: 'rw-r--r--',
        processName: 'bash',
        processId: 5678,
        isMalicious: false
      };

      (FileActivity.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await createFileActivity(
        'container-123',
        'write',
        '/tmp/test.txt',
        'regular',
        1024,
        'rw-r--r--',
        'bash',
        5678
      );

      expect(result).toEqual(mockRecord);
    });
  });

  describe('createProcessActivity', () => {
    it('should create process activity record', async () => {
      const startTime = new Date();
      const mockRecord = {
        id: 'test-uuid',
        containerId: 'container-123',
        processId: 1234,
        parentProcessId: 1,
        processName: 'node',
        commandLine: 'node app.js',
        user: 'root',
        startTime,
        endTime: null,
        cpuUsage: 10,
        memoryUsage: 256,
        status: 'running',
        exitCode: null,
        isMalicious: false
      };

      (ProcessActivity.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await createProcessActivity(
        'container-123',
        1234,
        1,
        'node',
        'node app.js',
        'root',
        startTime,
        null,
        10,
        256,
        'running'
      );

      expect(result).toEqual(mockRecord);
    });
  });

  describe('startContainerMonitoring', () => {
    let mockInterval: NodeJS.Timeout;

    beforeEach(() => {
      vi.useFakeTimers();
      mockInterval = {} as NodeJS.Timeout;
      vi.spyOn(global, 'setInterval').mockReturnValue(mockInterval);
      vi.spyOn(global, 'clearInterval');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start monitoring interval', async () => {
      mockContainerService.getContainerStatus.mockResolvedValue('running');
      mockContainerService.executeCommand.mockResolvedValue('mock stats output');
      (ContainerMonitoring.create as jest.Mock).mockResolvedValue({});

      const result = await startContainerMonitoring('container-123', 5000);

      expect(result).toBe(mockInterval);
      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('container-123');
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('should throw error if container is in error state', async () => {
      mockContainerService.getContainerStatus.mockResolvedValue('error');

      await expect(startContainerMonitoring('container-123')).rejects.toThrow(
        'Container container-123 is in error state'
      );
    });

    it('should stop monitoring if container stops', async () => {
      mockContainerService.getContainerStatus
        .mockResolvedValueOnce('running')
        .mockResolvedValueOnce('stopped');

      await startContainerMonitoring('container-123', 1000);

      // Get the callback function that was passed to setInterval
      const intervalCallback = (setInterval as jest.Mock).mock.calls[0][0];

      // Call the interval callback directly
      await intervalCallback();

      // Verify clearInterval was called
      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('stopContainerMonitoring', () => {
    it('should clear monitoring interval', () => {
      // Mock clearInterval
      const originalClearInterval = global.clearInterval;
      global.clearInterval = vi.fn();
      
      const mockInterval = {} as NodeJS.Timeout;
      stopContainerMonitoring(mockInterval);

      expect(global.clearInterval).toHaveBeenCalledWith(mockInterval);
      
      // Restore original
      global.clearInterval = originalClearInterval;
    });
  });

  describe('getSuspiciousActivities', () => {
    it('should get all suspicious activities', async () => {
      const mockNetworkActivities = [
        { id: '1', isMalicious: true, maliciousReason: 'C2 communication' }
      ];
      const mockFileActivities = [
        { id: '2', isMalicious: true, maliciousReason: 'Suspicious file write' }
      ];
      const mockProcessActivities = [
        { id: '3', isMalicious: true, maliciousReason: 'Known malware process' }
      ];

      (NetworkActivity.findAll as jest.Mock).mockResolvedValue(mockNetworkActivities);
      (FileActivity.findAll as jest.Mock).mockResolvedValue(mockFileActivities);
      (ProcessActivity.findAll as jest.Mock).mockResolvedValue(mockProcessActivities);

      const result = await getSuspiciousActivities('container-123');

      expect(result).toEqual({
        networkActivities: mockNetworkActivities,
        fileActivities: mockFileActivities,
        processActivities: mockProcessActivities
      });

      expect(NetworkActivity.findAll).toHaveBeenCalledWith({
        where: { containerId: 'container-123', isMalicious: true },
        order: [['timestamp', 'DESC']]
      });
    });
  });

  describe('getContainerMonitoringSummary', () => {
    it('should calculate monitoring summary', async () => {
      const mockMonitorings = [
        { cpuUsage: 50, memoryUsage: 512, networkInbound: 1000, networkOutbound: 2000 },
        { cpuUsage: 60, memoryUsage: 768, networkInbound: 1500, networkOutbound: 2500 }
      ];

      const mockFileActivities = [{ id: '1' }, { id: '2' }];
      const mockProcessActivities = [{ id: '1' }, { id: '2' }, { id: '3' }];

      (ContainerMonitoring.findAll as jest.Mock).mockResolvedValue(mockMonitorings);
      (FileActivity.findAll as jest.Mock).mockResolvedValue(mockFileActivities);
      (ProcessActivity.findAll as jest.Mock).mockResolvedValue(mockProcessActivities);
      
      // Mock suspicious activities
      (NetworkActivity.findAll as jest.Mock).mockResolvedValue([{ id: '1' }]);
      (FileActivity.findAll as jest.Mock)
        .mockResolvedValueOnce(mockFileActivities) // First call for total count
        .mockResolvedValueOnce([{ id: '2' }]); // Second call for suspicious
      (ProcessActivity.findAll as jest.Mock)
        .mockResolvedValueOnce(mockProcessActivities) // First call for total count
        .mockResolvedValueOnce([]); // Second call for suspicious

      const result = await getContainerMonitoringSummary('container-123');

      expect(result).toEqual({
        averageCpuUsage: 55,
        averageMemoryUsage: 640,
        totalNetworkInbound: 2500,
        totalNetworkOutbound: 4500,
        totalFileOperations: 2,
        totalProcesses: 3,
        suspiciousActivityCount: 2 // 1 network + 1 file + 0 process
      });
    });

    it('should handle empty monitoring data', async () => {
      (ContainerMonitoring.findAll as jest.Mock).mockResolvedValue([]);
      (FileActivity.findAll as jest.Mock).mockResolvedValue([]);
      (ProcessActivity.findAll as jest.Mock).mockResolvedValue([]);
      (NetworkActivity.findAll as jest.Mock).mockResolvedValue([]);

      const result = await getContainerMonitoringSummary('container-123');

      expect(result).toEqual({
        averageCpuUsage: NaN, // No data to average
        averageMemoryUsage: NaN,
        totalNetworkInbound: 0,
        totalNetworkOutbound: 0,
        totalFileOperations: 0,
        totalProcesses: 0,
        suspiciousActivityCount: 0
      });
    });
  });
});