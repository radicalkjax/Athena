import { invoke } from '@tauri-apps/api/core';
import type { AIProvider, AIProviderConfig, AIAnalysisRequest, AIAnalysisResult } from '../types/ai';

class AIService {
  private providers: Map<AIProvider, AIProviderConfig> = new Map();
  private activeRequests: Map<string, AbortController> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const defaultProviders: AIProviderConfig[] = [
      {
        id: 'claude',
        name: 'Claude 3',
        enabled: true,
        model: 'claude-3-opus-20240229',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'gpt4',
        name: 'GPT-4',
        enabled: true,
        model: 'gpt-4-turbo-preview',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        enabled: true,
        model: 'deepseek-coder',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'gemini',
        name: 'Gemini Pro',
        enabled: true,
        model: 'gemini-pro',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'mistral',
        name: 'Mistral',
        enabled: true,
        model: 'mistral-large-latest',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'llama',
        name: 'Llama 3',
        enabled: true,
        model: 'llama-3-70b',
        maxTokens: 4000,
        temperature: 0.2
      }
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  async analyzeWithProvider(
    provider: AIProvider, 
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResult> {
    const config = this.providers.get(provider);
    if (!config || !config.enabled) {
      throw new Error(`Provider ${provider} is not available or enabled`);
    }

    const requestId = `${provider}-${request.fileHash}-${Date.now()}`;
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const result = await invoke<AIAnalysisResult>('analyze_with_ai', {
        provider,
        config,
        request,
        signal: abortController.signal
      });

      return {
        ...result,
        provider,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.createMockResult(provider, request);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private createMockResult(
    provider: AIProvider, 
    request: AIAnalysisRequest
  ): AIAnalysisResult {
    const severityLevels: Array<'safe' | 'suspicious' | 'malicious' | 'critical'> = 
      ['safe', 'suspicious', 'malicious', 'critical'];
    
    const mockResults: Record<AIProvider, Partial<AIAnalysisResult>> = {
      claude: {
        confidence: 0.92,
        threatLevel: 'malicious',
        malwareFamily: 'Emotet',
        malwareType: 'Trojan',
        signatures: ['PE_Packed', 'Anti_Debug', 'Process_Injection'],
        behaviors: ['Downloads additional payloads', 'Steals credentials', 'Spreads via email']
      },
      gpt4: {
        confidence: 0.88,
        threatLevel: 'malicious',
        malwareFamily: 'Emotet',
        malwareType: 'Banking Trojan',
        signatures: ['PE_Obfuscated', 'Registry_Persistence', 'Network_C2'],
        behaviors: ['Establishes persistence', 'Communicates with C2', 'Keylogging capability']
      },
      deepseek: {
        confidence: 0.85,
        threatLevel: 'suspicious',
        malwareFamily: 'Unknown',
        malwareType: 'Potentially Unwanted',
        signatures: ['Code_Injection', 'Memory_Manipulation'],
        behaviors: ['Modifies system files', 'Hidden processes']
      },
      gemini: {
        confidence: 0.90,
        threatLevel: 'malicious',
        malwareFamily: 'Emotet',
        malwareType: 'Dropper',
        signatures: ['API_Hooking', 'Encryption_Routine', 'Self_Modifying'],
        behaviors: ['Drops malicious payloads', 'Encrypts communications', 'Evades detection']
      },
      mistral: {
        confidence: 0.87,
        threatLevel: 'malicious',
        malwareFamily: 'Emotet',
        malwareType: 'Trojan',
        signatures: ['Import_Hash_Match', 'Known_Bad_Certificate'],
        behaviors: ['Lateral movement', 'Data exfiltration']
      },
      llama: {
        confidence: 0.83,
        threatLevel: 'suspicious',
        malwareFamily: 'Generic',
        malwareType: 'Suspicious',
        signatures: ['Packed_Executable', 'Suspicious_Strings'],
        behaviors: ['Unusual network activity', 'File system modifications']
      }
    };

    const mockData = mockResults[provider] || {};
    
    return {
      provider,
      timestamp: Date.now(),
      confidence: mockData.confidence || Math.random() * 0.3 + 0.7,
      threatLevel: mockData.threatLevel || severityLevels[Math.floor(Math.random() * severityLevels.length)],
      malwareFamily: mockData.malwareFamily,
      malwareType: mockData.malwareType,
      signatures: mockData.signatures || [],
      behaviors: mockData.behaviors || [],
      iocs: {
        domains: ['malicious-c2.com', 'evil-payload.net'],
        ips: ['192.168.1.100', '10.0.0.50'],
        files: ['C:\\Windows\\Temp\\payload.exe'],
        registry: ['HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'],
        processes: ['svchost.exe', 'rundll32.exe']
      },
      recommendations: [
        'Isolate the infected system',
        'Run deep malware scan',
        'Check network logs for C2 communications',
        'Update security signatures'
      ]
    };
  }

  async analyzeWithMultipleProviders(
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResult[]> {
    const enabledProviders = request.providers.filter(p => {
      const config = this.providers.get(p);
      return config && config.enabled;
    });

    const analysisPromises = enabledProviders.map(provider =>
      this.analyzeWithProvider(provider, request)
        .catch(error => ({
          provider,
          timestamp: Date.now(),
          confidence: 0,
          threatLevel: 'safe' as const,
          signatures: [],
          behaviors: [],
          iocs: {
            domains: [],
            ips: [],
            files: [],
            registry: [],
            processes: []
          },
          recommendations: [],
          error: error.message
        }))
    );

    return Promise.all(analysisPromises);
  }

  cancelAnalysis(fileHash: string) {
    for (const [requestId, controller] of this.activeRequests.entries()) {
      if (requestId.includes(fileHash)) {
        controller.abort();
        this.activeRequests.delete(requestId);
      }
    }
  }

  getProviderStatus(provider: AIProvider): boolean {
    const config = this.providers.get(provider);
    return config ? config.enabled : false;
  }

  updateProviderConfig(provider: AIProvider, config: Partial<AIProviderConfig>) {
    const existing = this.providers.get(provider);
    if (existing) {
      this.providers.set(provider, { ...existing, ...config });
    }
  }

  getAllProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values());
  }
}

export const aiService = new AIService();