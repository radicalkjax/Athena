import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wasmService } from '../wasmService';
import { mockInvoke, flushPromises } from '../../test-setup';

describe('WasmService', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    // Reset initialized state by creating a new instance if needed
    // Note: Since wasmService is a singleton, we work with its existing state
  });

  describe('Runtime initialization', () => {
    it('should initialize runtime successfully', async () => {
      mockInvoke.mockResolvedValue('WASM runtime initialized');

      const result = await wasmService.initializeRuntime();

      expect(mockInvoke).toHaveBeenCalledWith('initialize_wasm_runtime');
      expect(result).toBe('WASM runtime initialized');
    });

    it('should handle initialization errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Runtime initialization failed'));

      await expect(wasmService.initializeRuntime()).rejects.toThrow(
        'Runtime initialization failed'
      );
    });

    it('should auto-initialize when loading modules', async () => {
      mockInvoke
        .mockResolvedValueOnce('WASM runtime initialized') // initialize_wasm_runtime
        .mockResolvedValueOnce({
          module_id: 'test-module',
          exports: ['analyze', 'get_version'],
          memory_size: 1048576,
        }); // load_wasm_module

      const moduleBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // WASM magic number
      await wasmService.loadModule('test-module', moduleBytes);

      // Should call initialize first, then load
      expect(mockInvoke).toHaveBeenCalledWith('initialize_wasm_runtime');
      expect(mockInvoke).toHaveBeenCalledWith('load_wasm_module', expect.any(Object));
    });
  });

  describe('Module loading', () => {
    beforeEach(async () => {
      // Pre-initialize runtime for these tests
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should load module from bytes', async () => {
      const mockModule = {
        module_id: 'crypto',
        exports: ['sha256', 'md5', 'sha512'],
        memory_size: 1048576,
      };

      mockInvoke.mockResolvedValue(mockModule);

      const moduleBytes = new Uint8Array(100);
      const result = await wasmService.loadModule('crypto', moduleBytes);

      expect(mockInvoke).toHaveBeenCalledWith('load_wasm_module', {
        moduleId: 'crypto',
        moduleBytes: expect.any(Array),
      });

      expect(result).toEqual(mockModule);
    });

    it('should load module from file path', async () => {
      const mockModule = {
        module_id: 'file-processor',
        exports: ['parse_file', 'extract_strings'],
        memory_size: 2097152,
      };

      mockInvoke.mockResolvedValue(mockModule);

      const result = await wasmService.loadModuleFromFile(
        'file-processor',
        '/path/to/module.wasm'
      );

      expect(mockInvoke).toHaveBeenCalledWith('load_wasm_module_from_file', {
        moduleId: 'file-processor',
        filePath: '/path/to/module.wasm',
      });

      expect(result).toEqual(mockModule);
    });

    it('should handle module loading errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid WASM module'));

      const moduleBytes = new Uint8Array(100);

      await expect(
        wasmService.loadModule('invalid-module', moduleBytes)
      ).rejects.toThrow('Invalid WASM module');
    });
  });

  describe('Function execution', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should execute module function successfully', async () => {
      const mockResult = {
        success: true,
        output: JSON.stringify({ hash: 'abc123' }),
        execution_time_ms: 5,
        memory_used: 1024,
      };

      mockInvoke.mockResolvedValue(mockResult);

      const result = await wasmService.executeFunction(
        'crypto',
        'sha256',
        [[1, 2, 3, 4]]
      );

      expect(mockInvoke).toHaveBeenCalledWith('execute_wasm_function', {
        moduleId: 'crypto',
        functionName: 'sha256',
        args: [[1, 2, 3, 4]],
      });

      expect(result).toEqual(mockResult);
      expect(result.success).toBe(true);
    });

    it('should handle function execution errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Function not found'));

      await expect(
        wasmService.executeFunction('crypto', 'nonexistent', [])
      ).rejects.toThrow('Function not found');
    });

    it('should track execution metrics', async () => {
      const mockResult = {
        success: true,
        output: '{"result": "ok"}',
        execution_time_ms: 10,
        memory_used: 2048,
      };

      mockInvoke.mockResolvedValue(mockResult);

      await wasmService.executeFunction('analysis-engine', 'analyze', [[0x00]]);

      expect(mockInvoke).toHaveBeenCalled();
      // Performance metrics should be recorded (tested via performanceMonitor)
    });
  });

  describe('Module management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should list loaded modules', async () => {
      const mockModules = [
        { module_id: 'crypto', exports: ['sha256'], memory_size: 1024 },
        { module_id: 'file-processor', exports: ['parse_file'], memory_size: 2048 },
      ];

      mockInvoke.mockResolvedValue(mockModules);

      const modules = await wasmService.getModules();

      expect(mockInvoke).toHaveBeenCalledWith('get_wasm_modules');
      expect(modules).toEqual(mockModules);
      expect(modules).toHaveLength(2);
    });

    it('should get memory usage', async () => {
      mockInvoke.mockResolvedValue(5242880); // 5 MB

      const usage = await wasmService.getMemoryUsage();

      expect(mockInvoke).toHaveBeenCalledWith('get_wasm_memory_usage');
      expect(usage).toBe(5242880);
    });

    it('should get runtime status', async () => {
      const mockModules = [
        { module_id: 'crypto', exports: ['sha256'], memory_size: 1024 },
      ];

      mockInvoke
        .mockResolvedValueOnce(mockModules) // get_wasm_modules
        .mockResolvedValueOnce(1048576); // get_wasm_memory_usage

      const status = await wasmService.getRuntimeStatus();

      expect(status).toHaveProperty('initialized', true);
      expect(status).toHaveProperty('totalMemory', 1048576);
      expect(status).toHaveProperty('modules');
      expect(status.modules).toEqual(mockModules);
    });

    it('should unload module and free memory', async () => {
      mockInvoke.mockResolvedValue('Module unloaded successfully');

      const result = await wasmService.unloadModule('crypto');

      expect(mockInvoke).toHaveBeenCalledWith('unload_wasm_module', {
        moduleId: 'crypto',
      });
      expect(result).toBe('Module unloaded successfully');
    });
  });

  describe('High-level module bindings', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should load crypto module with helper methods', async () => {
      const mockModule = {
        module_id: 'crypto',
        exports: ['sha256', 'md5'],
        memory_size: 1048576,
      };

      mockInvoke
        .mockResolvedValueOnce('crypto/target/wasm32-wasip1/release/athena_crypto.wasm') // get_wasm_module_path
        .mockResolvedValueOnce(mockModule); // load_wasm_module_from_file

      const cryptoModule = await wasmService.loadCryptoModule();

      expect(cryptoModule).toBeDefined();
      expect(mockInvoke).toHaveBeenCalledWith('load_wasm_module_from_file', {
        moduleId: 'crypto',
        filePath: expect.stringContaining('crypto'),
      });
    });

    it('should load file processor module', async () => {
      const mockModule = {
        module_id: 'file-processor',
        exports: ['parse_file'],
        memory_size: 2097152,
      };

      mockInvoke
        .mockResolvedValueOnce('file-processor/target/wasm32-wasip1/release/athena_file_processor.wasm')
        .mockResolvedValueOnce(mockModule);

      const fileProcessor = await wasmService.loadFileProcessorModule();

      expect(fileProcessor).toBeDefined();
    });

    it('should load analysis engine module', async () => {
      const mockModule = {
        module_id: 'analysis-engine',
        exports: ['analyze', 'disassemble'],
        memory_size: 4194304,
      };

      mockInvoke
        .mockResolvedValueOnce('analysis-engine/target/wasm32-wasip1/release/athena_analysis_engine.wasm')
        .mockResolvedValueOnce(mockModule);

      const analysisEngine = await wasmService.loadAnalysisEngineModule();

      expect(analysisEngine).toBeDefined();
    });

    it('should load pattern matcher module', async () => {
      const mockModule = {
        module_id: 'pattern-matcher',
        exports: ['scan', 'scan_with_rules'],
        memory_size: 3145728,
      };

      mockInvoke
        .mockResolvedValueOnce('pattern-matcher/target/wasm32-wasip1/release/athena_pattern_matcher.wasm')
        .mockResolvedValueOnce(mockModule);

      const patternMatcher = await wasmService.loadPatternMatcherModule();

      expect(patternMatcher).toBeDefined();
    });
  });

  describe('Session management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should create session', async () => {
      const mockSession = {
        session_id: 'session-123',
        module_id: 'analysis-engine',
        created_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockSession);

      const session = await wasmService.createSession('analysis-engine');

      expect(mockInvoke).toHaveBeenCalledWith('create_wasm_session', {
        moduleId: 'analysis-engine',
      });
      expect(session).toEqual(mockSession);
    });

    it('should execute session function', async () => {
      const mockResult = {
        success: true,
        output: '{"result": "processed"}',
        execution_time_ms: 8,
        memory_used: 1024,
      };

      mockInvoke.mockResolvedValue(mockResult);

      const result = await wasmService.executeSessionFunction(
        'session-123',
        'process',
        [{ data: 'test' }]
      );

      expect(mockInvoke).toHaveBeenCalledWith('execute_session_function', {
        sessionId: 'session-123',
        functionName: 'process',
        args: [{ data: 'test' }],
      });
      expect(result).toEqual(mockResult);
    });

    it('should list sessions', async () => {
      const mockSessions = [
        {
          session_id: 'session-1',
          module_id: 'crypto',
          created_at: new Date().toISOString(),
        },
        {
          session_id: 'session-2',
          module_id: 'file-processor',
          created_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockSessions);

      const sessions = await wasmService.listSessions();

      expect(mockInvoke).toHaveBeenCalledWith('list_wasm_sessions');
      expect(sessions).toHaveLength(2);
    });

    it('should destroy session', async () => {
      mockInvoke.mockResolvedValue('Session destroyed');

      const result = await wasmService.destroySession('session-123');

      expect(mockInvoke).toHaveBeenCalledWith('destroy_wasm_session', {
        sessionId: 'session-123',
      });
      expect(result).toBe('Session destroyed');
    });
  });

  describe('Metrics tracking', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('WASM runtime initialized');
      await wasmService.initializeRuntime();
      mockInvoke.mockClear();
    });

    it('should get module metrics', async () => {
      const mockMetrics = {
        total_executions: 100,
        total_execution_time_ms: 1000,
        average_execution_time_ms: 10,
        peak_memory_bytes: 2048000,
        total_fuel_consumed: 50000,
      };

      mockInvoke.mockResolvedValue(mockMetrics);

      const metrics = await wasmService.getMetrics('crypto');

      expect(mockInvoke).toHaveBeenCalledWith('get_wasm_metrics', {
        moduleId: 'crypto',
      });
      expect(metrics).toEqual(mockMetrics);
    });

    it('should get all metrics', async () => {
      const mockAllMetrics = {
        crypto: { total_executions: 50, total_execution_time_ms: 500 },
        'file-processor': { total_executions: 30, total_execution_time_ms: 800 },
      };

      mockInvoke.mockResolvedValue(mockAllMetrics);

      const allMetrics = await wasmService.getAllMetrics();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_wasm_metrics');
      expect(allMetrics).toHaveProperty('crypto');
      expect(allMetrics).toHaveProperty('file-processor');
    });

    it('should reset module metrics', async () => {
      mockInvoke.mockResolvedValue('Metrics reset');

      const result = await wasmService.resetMetrics('crypto');

      expect(mockInvoke).toHaveBeenCalledWith('reset_wasm_metrics', {
        moduleId: 'crypto',
      });
      expect(result).toBe('Metrics reset');
    });

    it('should reset all metrics', async () => {
      mockInvoke.mockResolvedValue('All metrics reset');

      const result = await wasmService.resetAllMetrics();

      expect(mockInvoke).toHaveBeenCalledWith('reset_all_wasm_metrics');
      expect(result).toBe('All metrics reset');
    });
  });
});
