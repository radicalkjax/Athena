import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import {
  initMetasploit,
  saveMetasploitConfig,
  hasMetasploitConfig,
  deleteMetasploitConfig,
  searchModules,
  getModuleDetails,
  searchVulnerabilityByCVE,
  getVulnerabilityDetails,
  findRelatedModules,
  enrichVulnerabilityData
} from '../../../services/metasploit';

// Mock dependencies
vi.mock('expo-secure-store');
vi.mock('../../../services/apiClient');

const mockSecureStore = SecureStore as any;

// Import the mocked functions
import { createMetasploitClient, safeApiCall, sanitizeRequestData } from '../../../services/apiClient';

// Cast to mocked functions
const mockCreateMetasploitClient = createMetasploitClient as vi.MockedFunction<typeof createMetasploitClient>;
const mockSafeApiCall = safeApiCall as vi.MockedFunction<typeof safeApiCall>;
const mockSanitizeRequestData = sanitizeRequestData as vi.MockedFunction<typeof sanitizeRequestData>;

describe('Metasploit Service', () => {
  const mockApiKey = 'test-api-key';
  const mockApiUrl = 'https://metasploit.example.com';
  const mockClient = {
    get: vi.fn(),
    post: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMetasploitClient.mockReturnValue(mockClient);
    mockSafeApiCall.mockImplementation(async (fn: any) => {
      const result = await fn();
      return result.data || result; // Extract data property if it exists
    });
    mockSanitizeRequestData.mockImplementation((data) => data); // Return data as-is
  });

  describe('initMetasploit', () => {
    it('should initialize with provided API key and URL', async () => {
      const client = await initMetasploit(mockApiKey, mockApiUrl);
      
      expect(mockCreateMetasploitClient).toHaveBeenCalledWith(mockApiKey, mockApiUrl);
      expect(client).toBe(mockClient);
    });

    it('should initialize with stored API key and URL', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });

      const client = await initMetasploit();
      
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('athena_metasploit_api_key');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('athena_metasploit_api_url');
      expect(mockCreateMetasploitClient).toHaveBeenCalledWith(mockApiKey, mockApiUrl);
      expect(client).toBe(mockClient);
    });

    it('should throw error when API key is missing', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await expect(initMetasploit()).rejects.toThrow('Metasploit API key not found');
    });

    it('should throw error when API URL is missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        return Promise.resolve(null);
      });

      await expect(initMetasploit()).rejects.toThrow('Metasploit API URL not found');
    });
  });

  describe('saveMetasploitConfig', () => {
    it('should save API key and URL to secure storage', async () => {
      await saveMetasploitConfig(mockApiKey, mockApiUrl);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('athena_metasploit_api_key', mockApiKey);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('athena_metasploit_api_url', mockApiUrl);
    });
  });

  describe('hasMetasploitConfig', () => {
    it('should return true when both API key and URL are stored', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });

      const result = await hasMetasploitConfig();
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });

      const result = await hasMetasploitConfig();
      expect(result).toBe(false);
    });

    it('should return false when API URL is missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        return Promise.resolve(null);
      });

      const result = await hasMetasploitConfig();
      expect(result).toBe(false);
    });
  });

  describe('deleteMetasploitConfig', () => {
    it('should delete API key and URL from secure storage', async () => {
      await deleteMetasploitConfig();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('athena_metasploit_api_key');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('athena_metasploit_api_url');
    });
  });

  describe('searchModules', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should search for modules successfully', async () => {
      const mockModules = [
        { name: 'exploit/windows/smb/ms17_010_eternalblue', type: 'exploit' },
        { name: 'auxiliary/scanner/smb/smb_version', type: 'auxiliary' }
      ];
      mockClient.get.mockResolvedValue({ data: { modules: mockModules } });

      const result = await searchModules('smb');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/modules/search', { params: { query: 'smb' } });
      expect(result).toEqual(mockModules);
    });

    it('should return empty array when no modules found', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      const result = await searchModules('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle search error', async () => {
      const error = new Error('Search failed');
      mockClient.get.mockRejectedValue(error);
      mockSafeApiCall.mockImplementation(() => { throw error; });

      await expect(searchModules('test')).rejects.toThrow('Search failed');
    });
  });

  describe('getModuleDetails', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should get module details successfully', async () => {
      const mockModule = {
        name: 'exploit/windows/smb/ms17_010_eternalblue',
        description: 'EternalBlue SMB Remote Windows Kernel Pool Corruption',
        author: ['shadowbrokers'],
        references: ['CVE-2017-0144']
      };
      mockClient.get.mockResolvedValue({ data: { module: mockModule } });

      const result = await getModuleDetails('exploit', 'windows/smb/ms17_010_eternalblue');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/modules/exploit/windows/smb/ms17_010_eternalblue');
      expect(result).toEqual(mockModule);
    });

    it('should return empty object when module not found', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      const result = await getModuleDetails('exploit', 'nonexistent');

      expect(result).toEqual({});
    });
  });

  describe('searchVulnerabilityByCVE', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should search vulnerabilities by CVE successfully', async () => {
      const mockVulnerabilities = [
        { id: '1', cve: 'CVE-2017-0144', description: 'EternalBlue vulnerability' }
      ];
      mockClient.get.mockResolvedValue({ data: { vulnerabilities: mockVulnerabilities } });

      const result = await searchVulnerabilityByCVE('CVE-2017-0144');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/vulnerabilities/search', { params: { cve: 'CVE-2017-0144' } });
      expect(result).toEqual(mockVulnerabilities);
    });

    it('should return empty array when no vulnerabilities found', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      const result = await searchVulnerabilityByCVE('CVE-9999-9999');

      expect(result).toEqual([]);
    });
  });

  describe('getVulnerabilityDetails', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should get vulnerability details successfully', async () => {
      const mockVulnerability = {
        id: '1',
        cve: 'CVE-2017-0144',
        description: 'EternalBlue vulnerability',
        cvss: 9.8
      };
      mockClient.get.mockResolvedValue({ data: { vulnerability: mockVulnerability } });

      const result = await getVulnerabilityDetails('1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/vulnerabilities/1');
      expect(result).toEqual(mockVulnerability);
    });
  });

  describe('findRelatedModules', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should find related modules successfully', async () => {
      const mockModules = [
        { name: 'exploit/windows/smb/ms17_010_eternalblue', type: 'exploit' }
      ];
      mockClient.get.mockResolvedValue({ data: { modules: mockModules } });

      const result = await findRelatedModules('1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/vulnerabilities/1/modules');
      expect(result).toEqual(mockModules);
    });
  });

  describe('enrichVulnerabilityData', () => {
    beforeEach(() => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'athena_metasploit_api_key') return Promise.resolve(mockApiKey);
        if (key === 'athena_metasploit_api_url') return Promise.resolve(mockApiUrl);
        return Promise.resolve(null);
      });
    });

    it('should enrich vulnerability data with Metasploit information', async () => {
      const vulnerabilities = [
        { name: 'EternalBlue', cveId: 'CVE-2017-0144' }
      ];

      const mockMetasploitVuln = { id: '1', description: 'EternalBlue SMB vulnerability' };
      const mockModules = [
        { name: 'exploit/windows/smb/ms17_010_eternalblue', type: 'exploit', description: 'EternalBlue exploit' }
      ];

      mockClient.get.mockImplementation((url) => {
        if (url.includes('search')) {
          return Promise.resolve({ vulnerabilities: [mockMetasploitVuln] });
        }
        if (url.includes('modules')) {
          return Promise.resolve({ modules: mockModules });
        }
        return Promise.resolve({});
      });

      const result = await enrichVulnerabilityData(vulnerabilities);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'EternalBlue',
        cveId: 'CVE-2017-0144',
        metasploitId: '1',
        metasploitDescription: 'EternalBlue SMB vulnerability',
        metasploitModules: [
          {
            name: 'exploit/windows/smb/ms17_010_eternalblue',
            type: 'exploit',
            description: 'EternalBlue exploit'
          }
        ]
      });
    });

    it('should handle vulnerabilities without CVE IDs', async () => {
      const vulnerabilities = [
        { name: 'Custom vulnerability' }
      ];

      const result = await enrichVulnerabilityData(vulnerabilities);

      expect(result).toEqual(vulnerabilities);
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('should handle vulnerabilities not found in Metasploit', async () => {
      const vulnerabilities = [
        { name: 'Unknown', cveId: 'CVE-9999-9999' }
      ];

      mockClient.get.mockResolvedValue({ data: {} });

      const result = await enrichVulnerabilityData(vulnerabilities);

      expect(result).toEqual(vulnerabilities);
    });

    it('should handle enrichment errors gracefully', async () => {
      const vulnerabilities = [
        { name: 'Error vuln', cveId: 'CVE-ERROR' }
      ];

      mockClient.get.mockRejectedValue(new Error('API error'));

      const result = await enrichVulnerabilityData(vulnerabilities);

      expect(result).toEqual(vulnerabilities);
    });

    it('should handle mixed vulnerabilities', async () => {
      const vulnerabilities = [
        { name: 'EternalBlue', cveId: 'CVE-2017-0144' },
        { name: 'No CVE' },
        { name: 'Unknown', cveId: 'CVE-9999-9999' }
      ];

      mockClient.get.mockImplementation((url, options) => {
        if (options?.params?.cve === 'CVE-2017-0144') {
          return Promise.resolve({ vulnerabilities: [{ id: '1', description: 'EternalBlue' }] });
        }
        if (url.includes('/modules')) {
          return Promise.resolve({ modules: [] });
        }
        return Promise.resolve({});
      });

      const result = await enrichVulnerabilityData(vulnerabilities);

      expect(result).toHaveLength(3);
      expect(result[0].metasploitId).toBe('1');
      expect(result[1]).toEqual(vulnerabilities[1]);
      expect(result[2]).toEqual(vulnerabilities[2]);
    });
  });
});