import { Component, createSignal, For, onMount, Show } from 'solid-js';
import AnalysisPanel from './shared/AnalysisPanel';
import { StatCard } from './shared/StatCard';
import { invokeCommand } from '../../utils/tauriCompat';
import './PlatformConfig.css';

interface AIProviderConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  models: string[];
}

interface AIProviderStatus {
  configured: boolean;
  enabled: boolean;
  circuit_state: string;
  queue_length: number;
  avg_latency_ms: number | null;
  healthy: boolean;
  last_error: string | null;
}

interface CircuitBreakerState {
  is_open: boolean;
  provider: string;
}

interface SystemStats {
  cpu: {
    usage: number;
    cores: { id: number; usage: number; frequency: number }[];
    frequency: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    swap_total: number;
    swap_used: number;
    usage_percentage: number;
  };
  uptime: number;
  boot_time: number;
}

interface WasmModuleInfo {
  id: string;
  name: string;
  memory_bytes: number;
}

interface ModelInfo {
  id: string;
  name: string;
  description: string | null;
  context_window: number | null;
  max_output_tokens: number | null;
}

// Default provider definitions (metadata only, not config)
// Models are left empty - fetched dynamically when API key is configured
const PROVIDER_DEFINITIONS: Omit<AIProviderConfig, 'apiKey' | 'enabled'>[] = [
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🤖',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    icon: '🧠',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔍',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🌟',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '🌊',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  },
  {
    id: 'llama',
    name: 'Llama (via Groq)',
    icon: '🦙',
    model: '',
    maxTokens: 4096,
    temperature: 0.1,
    models: []
  }
];

const PlatformConfig: Component = () => {
  const [aiProviders, setAiProviders] = createSignal<AIProviderConfig[]>(
    PROVIDER_DEFINITIONS.map(p => ({ ...p, apiKey: '', enabled: false }))
  );
  const [providerStatus, setProviderStatus] = createSignal<Record<string, AIProviderStatus>>({});
  const [systemStats, setSystemStats] = createSignal<SystemStats | null>(null);
  const [wasmModules, setWasmModules] = createSignal<WasmModuleInfo[]>([]);
  const [wasmMemoryUsage, setWasmMemoryUsage] = createSignal<number>(0);
  const [providerModels, setProviderModels] = createSignal<Record<string, ModelInfo[]>>({});
  const [loadingModels, setLoadingModels] = createSignal<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [circuitBreakerStates, setCircuitBreakerStates] = createSignal<Record<string, boolean>>({});
  const [deletingKey, setDeletingKey] = createSignal<string | null>(null);
  const [cleaningCache, setCleaningCache] = createSignal(false);

  const [deploymentTargets, setDeploymentTargets] = createSignal([
    { id: 'fermyon', name: 'Fermyon Cloud (Global Edge)', enabled: true },
    { id: 'wasmcloud', name: 'wasmCloud Lattice (Distributed)', enabled: true },
    { id: 'k8s', name: 'Kubernetes + WASM Runtime', enabled: false },
    { id: 'self', name: 'Self-hosted Edge Nodes', enabled: false }
  ]);

  const [ensembleSettings, setEnsembleSettings] = createSignal({
    consensusVoting: true,
    weightByConfidence: true,
    crossValidation: false,
    consensusThreshold: 75,
    enabledProviders: [] as string[]
  });
  const [ensembleDirty, setEnsembleDirty] = createSignal(false);

  // Load all configuration on mount
  onMount(() => {
    loadAllData();
    // Set up periodic refresh for system stats
    const interval = setInterval(refreshSystemStats, 5000);
    return () => clearInterval(interval);
  });

  const loadAllData = () => {
    setIsLoading(true);
    setError(null);

    // Load AI provider configs
    invokeCommand('list_ai_provider_configs')
      .then((configs: Record<string, any>) => {
        // Merge saved configs with provider definitions
        const merged = PROVIDER_DEFINITIONS.map(def => {
          const saved = configs[def.id];
          return {
            ...def,
            apiKey: saved?.api_key || '',
            enabled: saved?.enabled || false,
            model: saved?.model || def.model,
            maxTokens: saved?.max_tokens || def.maxTokens,
            temperature: saved?.temperature || def.temperature,
          };
        });
        setAiProviders(merged);
        // Fetch models for providers that have API keys but no models loaded yet
        setTimeout(() => {
          merged.forEach(p => {
            if (p.apiKey && p.models.length === 0) {
              fetchModels(p.id);
            }
          });
        }, 100);
      })
      .catch((err) => console.warn('Failed to load AI configs:', err));

    // Load AI provider status
    invokeCommand('get_ai_provider_status')
      .then((status: Record<string, AIProviderStatus>) => {
        setProviderStatus(status);
      })
      .catch((err) => console.warn('Failed to load provider status:', err));

    // Load circuit breaker states
    loadCircuitBreakerStates();

    // Load system stats
    refreshSystemStats();

    // Load WASM modules info
    invokeCommand('get_wasm_modules')
      .then((modules: WasmModuleInfo[]) => {
        setWasmModules(modules);
      })
      .catch((err) => console.warn('Failed to load WASM modules:', err));

    // Load WASM memory usage
    invokeCommand('get_wasm_memory_usage')
      .then((usage: { total_bytes: number }) => {
        setWasmMemoryUsage(usage?.total_bytes || 0);
      })
      .catch((err) => console.warn('Failed to load WASM memory:', err));

    // Load ensemble settings from backend
    invokeCommand('get_ensemble_settings')
      .then((settings: any) => {
        setEnsembleSettings({
          consensusVoting: settings.consensus_voting ?? true,
          weightByConfidence: settings.weight_by_confidence ?? true,
          crossValidation: settings.cross_validation ?? false,
          consensusThreshold: settings.consensus_threshold ?? 75,
          enabledProviders: settings.enabled_providers ?? []
        });
        setEnsembleDirty(false);
      })
      .catch((err) => console.warn('Failed to load ensemble settings:', err));

    setIsLoading(false);
  };

  const refreshSystemStats = () => {
    invokeCommand('get_system_stats')
      .then((stats: SystemStats) => {
        setSystemStats(stats);
      })
      .catch((err) => console.warn('Failed to load system stats:', err));
  };

  const loadCircuitBreakerStates = async () => {
    const providers = ['claude', 'openai', 'deepseek', 'gemini', 'mistral', 'llama'];
    const states: Record<string, boolean> = {};

    for (const provider of providers) {
      try {
        const isOpen: boolean = await invokeCommand('is_circuit_breaker_open', { provider });
        states[provider] = isOpen;
      } catch (err) {
        console.warn(`Failed to get circuit breaker state for ${provider}:`, err);
        states[provider] = false;
      }
    }

    setCircuitBreakerStates(states);
  };

  const deleteApiKey = async (providerId: string) => {
    const provider = aiProviders().find(p => p.id === providerId);
    if (!provider) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the API key for ${provider.name}?\n\nThis will remove the key from secure storage and you'll need to re-enter it to use this provider.`
    );

    if (!confirmed) return;

    setDeletingKey(providerId);
    setError(null);

    try {
      await invokeCommand('delete_api_key_from_storage', { provider: providerId });

      // Update the provider config to clear the API key
      setAiProviders(providers =>
        providers.map(p => p.id === providerId ? { ...p, apiKey: '', enabled: false } : p)
      );

      // Refresh provider status
      const status: Record<string, AIProviderStatus> = await invokeCommand('get_ai_provider_status');
      setProviderStatus(status);

      setSuccessMessage(`API key deleted for ${provider.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Failed to delete API key: ${err?.message || err}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingKey(null);
    }
  };

  const resetCircuitBreaker = async (providerId: string) => {
    const provider = aiProviders().find(p => p.id === providerId);
    if (!provider) return;

    setError(null);

    try {
      await invokeCommand('reset_circuit_breaker', { provider: providerId });

      // Reload circuit breaker states
      await loadCircuitBreakerStates();

      setSuccessMessage(`Circuit breaker reset for ${provider.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Failed to reset circuit breaker: ${err?.message || err}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const cleanupExpiredCache = async () => {
    setCleaningCache(true);
    setError(null);

    try {
      const cleaned: number = await invokeCommand('cleanup_cache');
      setSuccessMessage(`Cleaned up ${cleaned} expired cache entries`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Failed to cleanup cache: ${err?.message || err}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setCleaningCache(false);
    }
  };

  // Fetch models dynamically from the provider's API
  const fetchModels = async (providerId: string) => {
    // Check if provider has an API key configured
    const provider = aiProviders().find(p => p.id === providerId);
    if (!provider?.apiKey) {
      setError(`No API key configured for ${provider?.name || providerId}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoadingModels(prev => ({ ...prev, [providerId]: true }));
    setError(null);

    try {
      // Map frontend provider IDs to backend provider names
      // Note: backend uses 'llama' for Groq/Llama provider
      const backendProviderMap: Record<string, string> = {
        'claude': 'claude',
        'openai': 'openai',
        'deepseek': 'deepseek',
        'gemini': 'gemini',
        'mistral': 'mistral',
        'llama': 'llama'  // Llama models are served via Groq, but backend uses 'llama' key
      };

      const backendProvider = backendProviderMap[providerId] || providerId;
      console.log(`Fetching models for ${backendProvider}...`);

      const models: ModelInfo[] = await invokeCommand('list_ai_models', { provider: backendProvider });
      console.log(`Received ${models?.length || 0} models for ${providerId}:`, models);

      if (!models || models.length === 0) {
        setError(`No models returned from ${provider.name} API`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      setProviderModels(prev => ({ ...prev, [providerId]: models }));

      // Update the provider's models array with fetched model IDs
      setAiProviders(providers =>
        providers.map(p => {
          if (p.id === providerId) {
            const modelIds = models.map((m: ModelInfo) => m.id);
            // If current model is not in the list, add it
            if (p.model && !modelIds.includes(p.model)) {
              modelIds.unshift(p.model);
            }
            return { ...p, models: modelIds.length > 0 ? modelIds : p.models };
          }
          return p;
        })
      );

      setSuccessMessage(`Loaded ${models.length} models for ${provider.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(`Failed to fetch models for ${providerId}:`, err);
      const errorMsg = err?.message || err?.toString() || 'Unknown error';
      setError(`Failed to fetch ${provider.name} models: ${errorMsg}`);
      setTimeout(() => setError(null), 5000);
      // Keep the hardcoded fallback models on error
    } finally {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const updateProviderConfig = (id: string, field: keyof AIProviderConfig, value: any) => {
    setAiProviders(providers =>
      providers.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  const saveProviderConfig = (provider: AIProviderConfig) => {
    setIsSaving(true);
    setError(null);

    const backendConfig = {
      id: provider.id,
      name: provider.name,
      api_key: provider.apiKey || null,
      base_url: null,
      model: provider.model,
      max_tokens: provider.maxTokens,
      temperature: provider.temperature,
      enabled: provider.enabled,
    };

    invokeCommand('update_ai_provider_config', { provider: provider.id, config: backendConfig })
      .then(() => {
        setSuccessMessage(`${provider.name} configuration saved`);
        setTimeout(() => setSuccessMessage(null), 3000);
        // Refresh provider status after saving
        invokeCommand('get_ai_provider_status')
          .then((status: Record<string, AIProviderStatus>) => setProviderStatus(status))
          .catch(() => {});
        // Auto-fetch models if API key was provided and no models loaded yet
        if (provider.apiKey && provider.models.length === 0) {
          fetchModels(provider.id);
        }
      })
      .catch((err) => {
        setError(`Failed to save ${provider.name}: ${err}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const toggleDeploymentTarget = (id: string) => {
    setDeploymentTargets(targets =>
      targets.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    );
  };

  const updateEnsembleSetting = (field: string, value: any) => {
    setEnsembleSettings(prev => ({ ...prev, [field]: value }));
    setEnsembleDirty(true);
  };

  const saveEnsembleSettings = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const settings = ensembleSettings();
      // Convert to backend format (snake_case)
      const backendSettings = {
        consensus_voting: settings.consensusVoting,
        weight_by_confidence: settings.weightByConfidence,
        cross_validation: settings.crossValidation,
        consensus_threshold: settings.consensusThreshold,
        enabled_providers: settings.enabledProviders
      };

      await invokeCommand('update_ensemble_settings', { settings: backendSettings });
      setSuccessMessage('Ensemble settings saved');
      setEnsembleDirty(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Failed to save ensemble settings: ${err?.message || err}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate derived stats
  const getProvidersOnline = () => {
    const status = providerStatus();
    // Only count providers that have API keys configured
    const configuredProviders = aiProviders().filter(p => p.apiKey);
    const configuredCount = configuredProviders.length;

    if (configuredCount === 0) {
      return '0/0';
    }

    // Count how many configured providers are healthy
    const onlineCount = configuredProviders.filter(p => {
      const s = status[p.id];
      return s?.healthy === true;
    }).length;

    return `${onlineCount}/${configuredCount}`;
  };

  const getMemoryUsage = () => {
    const stats = systemStats();
    if (!stats?.memory) return isLoading() ? '...' : 'N/A';
    const used = stats.memory.used;
    const total = stats.memory.total;
    // Validate values are valid numbers
    if (typeof used !== 'number' || typeof total !== 'number' || isNaN(used) || isNaN(total)) {
      return 'N/A';
    }
    const usedGB = (used / 1024 / 1024 / 1024).toFixed(1);
    const totalGB = (total / 1024 / 1024 / 1024).toFixed(1);
    return `${usedGB}/${totalGB}GB`;
  };

  const getCpuUsage = () => {
    const stats = systemStats();
    if (!stats?.cpu) return isLoading() ? '...' : 'N/A';
    const cpu = stats.cpu.usage;
    // Validate value is a valid number
    if (typeof cpu !== 'number' || isNaN(cpu)) {
      return 'N/A';
    }
    return `${Math.round(cpu)}%`;
  };

  const getUptime = () => {
    const stats = systemStats();
    if (!stats) return isLoading() ? '...' : 'N/A';
    const totalSeconds = stats.uptime;
    // Validate that uptime is a valid number
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
      return 'N/A';
    }
    if (totalSeconds < 60) return `${Math.floor(totalSeconds)}s`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const exportConfig = () => {
    const config = {
      aiProviders: aiProviders().map(p => ({
        id: p.id,
        enabled: p.enabled,
        model: p.model,
        maxTokens: p.maxTokens,
        temperature: p.temperature,
        // Don't export API keys for security
      })),
      deploymentTargets: deploymentTargets(),
      ensembleSettings: ensembleSettings(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'athena-platform-config.json';
    link.click();
    URL.revokeObjectURL(url);
    setSuccessMessage('Configuration exported');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🛠️ WASM Platform Configuration
      </h2>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Configure runtime environment and AI providers</p>

      <Show when={error()}>
        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid var(--danger-color); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
          <span style="color: var(--danger-color);">❌ {error()}</span>
        </div>
      </Show>

      <Show when={successMessage()}>
        <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid var(--success-color); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
          <span style="color: var(--success-color);">✅ {successMessage()}</span>
        </div>
      </Show>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel title="Runtime Environment" icon="🏗️" className="scrollable-panel">
            <div style="padding: 0 20px 20px 20px;">
              <div style="margin-bottom: 20px;">
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Wasmtime Runtime:</span>
                  <span style="color: var(--barbie-pink); font-weight: 600;">29.0</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Component Model:</span>
                  <span style="color: var(--success-color); font-weight: 600;">Enabled</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">WASM Modules Loaded:</span>
                  <span style="color: var(--info-color); font-weight: 600;">{wasmModules().length}</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">WASM Memory Usage:</span>
                  <span style="color: var(--warning-color); font-weight: 600;">{Math.round(wasmMemoryUsage() / 1024 / 1024)}MB</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">System Uptime:</span>
                  <span style="color: var(--barbie-pink); font-weight: 600;">{getUptime()}</span>
                </div>
              </div>
          
            <h4 style="color: var(--barbie-pink); margin-bottom: 15px;">Deployment Targets</h4>
            <div style="background: var(--code-bg); padding: 15px; border-radius: 6px;">
              <For each={deploymentTargets()}>
                {(target) => (
                  <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                    <input 
                      type="checkbox" 
                      checked={target.enabled}
                      onChange={() => toggleDeploymentTarget(target.id)}
                      style="margin-right: 10px;"
                    />
                    <span style="color: var(--text-primary);">{target.name}</span>
                  </label>
                )}
              </For>
            </div>
            </div>
          </AnalysisPanel>
        
          <AnalysisPanel title="AI Provider Configuration" icon="🤖" className="scrollable-panel">
            <div style="margin-bottom: 20px;">
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Providers Configured:</span>
                <span style="color: var(--barbie-pink); font-weight: 600;">{aiProviders().filter(p => p.apiKey).length}/{aiProviders().length}</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Providers Online:</span>
                <span style="color: var(--success-color); font-weight: 600;">{getProvidersOnline()}</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Ensemble Mode:</span>
                <span style="color: var(--success-color); font-weight: 600;">{ensembleSettings().consensusVoting ? 'Consensus Voting' : 'First Response'}</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Consensus Threshold:</span>
                <span style="color: var(--info-color); font-weight: 600;">{ensembleSettings().consensusThreshold}%</span>
              </div>
            </div>

            <h4 style="color: var(--barbie-pink); margin-bottom: 15px;">Active AI Providers</h4>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <For each={aiProviders()}>
                {(provider) => {
                  const status = () => providerStatus()[provider.id];
                  return (
                  <div style="background: var(--code-bg); padding: 15px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <strong style="color: var(--barbie-pink); font-size: 1.1rem;">
                          <span style="margin-right: 8px;">{provider.icon}</span>
                          {provider.name}
                        </strong>
                        <Show when={status()}>
                          <span style={{
                            'font-size': '0.75rem',
                            padding: '2px 8px',
                            'border-radius': '10px',
                            background: status()?.healthy ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)',
                            color: status()?.healthy ? 'var(--success-color)' : 'var(--danger-color)'
                          }}>
                            {status()?.healthy ? '● Online' : status()?.last_error || '○ Offline'}
                          </span>
                        </Show>
                        <Show when={circuitBreakerStates()[provider.id] !== undefined}>
                          {() => {
                            const isOpen = circuitBreakerStates()[provider.id];
                            return (
                              <span style={{
                                'font-size': '0.75rem',
                                padding: '2px 8px',
                                'border-radius': '10px',
                                background: isOpen ? 'rgba(255, 107, 107, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                                color: isOpen ? 'var(--danger-color)' : 'var(--success-color)'
                              }}>
                                Circuit: {isOpen ? 'Open' : 'Closed'}
                              </span>
                            );
                          }}
                        </Show>
                        <Show when={status()?.configured}>
                          <span style={{
                            'font-size': '0.75rem',
                            padding: '2px 8px',
                            'border-radius': '10px',
                            background: 'rgba(33, 150, 243, 0.2)',
                            color: 'var(--info-color)'
                          }}>
                            🔑 Key Configured
                          </span>
                        </Show>
                      </div>
                      <label style="display: flex; align-items: center; cursor: pointer;">
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(e) => updateProviderConfig(provider.id, 'enabled', e.currentTarget.checked)}
                          style="margin-right: 8px;"
                        />
                        <span style={{color: provider.enabled ? 'var(--success-color)' : 'var(--text-secondary)'}}>
                          {provider.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Model:</label>
                        <div style="display: flex; gap: 4px;">
                          <select
                            value={provider.model}
                            onChange={(e) => updateProviderConfig(provider.id, 'model', e.currentTarget.value)}
                            disabled={loadingModels()[provider.id] || provider.models.length === 0}
                            style="flex: 1; height: 38px; padding: 0 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; box-sizing: border-box; color: var(--text-primary);"
                          >
                            <Show when={loadingModels()[provider.id]}>
                              <option>Loading models...</option>
                            </Show>
                            <Show when={!loadingModels()[provider.id] && provider.models.length === 0}>
                              <option value="">{provider.apiKey ? 'Click 🔄 to fetch' : 'Enter API key first'}</option>
                            </Show>
                            <Show when={!loadingModels()[provider.id] && provider.models.length > 0}>
                              <For each={provider.models}>
                                {(model) => {
                                  const modelInfo = providerModels()[provider.id]?.find(m => m.id === model);
                                  const displayName = modelInfo?.name || model;
                                  return <option value={model}>{displayName}</option>;
                                }}
                              </For>
                            </Show>
                          </select>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              fetchModels(provider.id);
                            }}
                            disabled={loadingModels()[provider.id] || !provider.apiKey}
                            title={!provider.apiKey ? "Enter API key first" : "Fetch models from API"}
                            style="width: 38px; height: 38px; padding: 0; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; box-sizing: border-box; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 1;"
                          >
                            {loadingModels()[provider.id] ? '⏳' : '🔄'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">API Key:</label>
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={provider.apiKey}
                          onChange={(e) => updateProviderConfig(provider.id, 'apiKey', e.currentTarget.value)}
                          style="width: 100%; height: 38px; padding: 0 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; box-sizing: border-box; color: var(--text-primary);"
                        />
                      </div>

                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Max Tokens:</label>
                        <input
                          type="number"
                          value={provider.maxTokens}
                          onChange={(e) => updateProviderConfig(provider.id, 'maxTokens', parseInt(e.currentTarget.value))}
                          style="width: 100%; height: 38px; padding: 0 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; box-sizing: border-box; color: var(--text-primary);"
                        />
                      </div>

                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Temperature:</label>
                        <input
                          type="number"
                          value={provider.temperature}
                          step="0.1"
                          min="0"
                          max="1"
                          onChange={(e) => updateProviderConfig(provider.id, 'temperature', parseFloat(e.currentTarget.value))}
                          style="width: 100%; height: 38px; padding: 0 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; box-sizing: border-box; color: var(--text-primary);"
                        />
                      </div>
                    </div>

                    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <div style="display: flex; gap: 8px;">
                        <Show when={provider.apiKey}>
                          <button
                            class="btn btn-secondary"
                            onClick={() => deleteApiKey(provider.id)}
                            disabled={deletingKey() === provider.id}
                            title="Delete API key from secure storage"
                            style="padding: 6px 12px; font-size: 0.85rem; background: rgba(255, 107, 107, 0.1); border-color: var(--danger-color); color: var(--danger-color);"
                          >
                            {deletingKey() === provider.id ? '⏳ Deleting...' : '🗑️ Delete Key'}
                          </button>
                        </Show>
                        <Show when={circuitBreakerStates()[provider.id]}>
                          <button
                            class="btn btn-secondary"
                            onClick={() => resetCircuitBreaker(provider.id)}
                            title="Reset circuit breaker for this provider"
                            style="padding: 6px 12px; font-size: 0.85rem; background: rgba(255, 193, 7, 0.1); border-color: var(--warning-color); color: var(--warning-color);"
                          >
                            🔄 Reset Breaker
                          </button>
                        </Show>
                      </div>
                      <button
                        class="btn btn-secondary"
                        onClick={() => saveProviderConfig(provider)}
                        disabled={isSaving()}
                        style="padding: 6px 16px; font-size: 0.85rem;"
                      >
                        {isSaving() ? '⏳ Saving...' : '💾 Save'}
                      </button>
                    </div>
                  </div>
                  );
                }}
              </For>
            </div>

            <h4 style="color: var(--barbie-pink); margin-top: 20px; margin-bottom: 15px;">
              Ensemble Settings
              <Show when={ensembleDirty()}>
                <span style="font-size: 0.75rem; color: var(--warning-color); margin-left: 8px;">● Unsaved</span>
              </Show>
            </h4>
            <div style="background: var(--code-bg); padding: 15px; border-radius: 6px; margin-bottom: 20px;">
              <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 15px;">
                Ensemble mode queries multiple AI providers in parallel and combines their results using consensus voting.
                This improves accuracy by 15-25% compared to single-model analysis.
              </p>

              <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={ensembleSettings().consensusVoting}
                  onChange={(e) => updateEnsembleSetting('consensusVoting', e.currentTarget.checked)}
                  style="margin-right: 10px;"
                />
                <span style="color: var(--text-primary);">Enable consensus voting</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 8px;">
                  (aggregate threat levels across providers)
                </span>
              </label>
              <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={ensembleSettings().weightByConfidence}
                  onChange={(e) => updateEnsembleSetting('weightByConfidence', e.currentTarget.checked)}
                  style="margin-right: 10px;"
                />
                <span style="color: var(--text-primary);">Weight responses by model confidence</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 8px;">
                  (high-confidence votes count more)
                </span>
              </label>
              <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={ensembleSettings().crossValidation}
                  onChange={(e) => updateEnsembleSetting('crossValidation', e.currentTarget.checked)}
                  style="margin-right: 10px;"
                />
                <span style="color: var(--text-primary);">Enable model cross-validation</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 8px;">
                  (models critique each other's findings)
                </span>
              </label>

              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary);">
                  Minimum Consensus Threshold: <strong style="color: var(--barbie-pink);">{ensembleSettings().consensusThreshold}%</strong>
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={ensembleSettings().consensusThreshold}
                  onChange={(e) => updateEnsembleSetting('consensusThreshold', parseInt(e.currentTarget.value))}
                  style="width: 100%;"
                />
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                  <span>50% (simple majority)</span>
                  <span>100% (unanimous)</span>
                </div>
              </div>

              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">
                  Providers for Ensemble (leave empty to use all enabled):
                </label>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  <For each={aiProviders().filter(p => p.apiKey && p.enabled)}>
                    {(provider) => {
                      const isSelected = () => ensembleSettings().enabledProviders.includes(provider.id);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const current = ensembleSettings().enabledProviders;
                            const updated = isSelected()
                              ? current.filter(id => id !== provider.id)
                              : [...current, provider.id];
                            updateEnsembleSetting('enabledProviders', updated);
                          }}
                          style={{
                            padding: '4px 12px',
                            'border-radius': '16px',
                            border: isSelected() ? '2px solid var(--barbie-pink)' : '1px solid var(--accent-bg)',
                            background: isSelected() ? 'rgba(255, 107, 157, 0.2)' : 'var(--panel-bg)',
                            color: isSelected() ? 'var(--barbie-pink)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            'font-size': '0.85rem'
                          }}
                        >
                          {provider.icon} {provider.name}
                        </button>
                      );
                    }}
                  </For>
                  <Show when={aiProviders().filter(p => p.apiKey && p.enabled).length === 0}>
                    <span style="color: var(--text-secondary); font-style: italic;">
                      No providers configured. Enable providers above to use ensemble mode.
                    </span>
                  </Show>
                </div>
              </div>

              <div style="text-align: right; margin-top: 15px;">
                <button
                  class="btn btn-secondary"
                  onClick={saveEnsembleSettings}
                  disabled={isSaving() || !ensembleDirty()}
                  style="padding: 6px 16px; font-size: 0.85rem;"
                >
                  {isSaving() ? '⏳ Saving...' : '💾 Save Ensemble Settings'}
                </button>
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="platform-sidebar">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 Platform Monitoring
          </h3>

          <div class="stats-grid">
            <StatCard
              label="System Uptime"
              value={getUptime()}
            />
            <StatCard
              label="Providers Online"
              value={getProvidersOnline()}
            />
            <StatCard
              label="Memory Usage"
              value={getMemoryUsage()}
            />
            <StatCard
              label="CPU Utilization"
              value={getCpuUsage()}
            />
          </div>

          <Show when={wasmModules().length > 0}>
            <h3 style="color: var(--barbie-pink); margin: 15px 0;">
              🔧 WASM Modules
            </h3>
            <div style="background: var(--code-bg); padding: 10px; border-radius: 6px; font-size: 0.85rem; max-height: 150px; overflow-y: auto;">
              <For each={wasmModules()}>
                {(mod) => (
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.1);">
                    <span style="color: var(--text-primary);">{mod.name || mod.id}</span>
                    <span style="color: var(--text-secondary);">{Math.round(mod.memory_bytes / 1024)}KB</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <h3 style="color: var(--barbie-pink); margin: 15px 0;">
            🎬 Actions
          </h3>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button
              class="btn btn-primary"
              onClick={() => {
                // Save all provider configs
                aiProviders().forEach(p => saveProviderConfig(p));
              }}
              disabled={isSaving()}
            >
              {isSaving() ? '⏳ Saving...' : '🚀 Save All Configs'}
            </button>
            <button
              class="btn btn-secondary"
              onClick={() => {
                loadAllData();
                setSuccessMessage('Platform data refreshed');
                setTimeout(() => setSuccessMessage(null), 3000);
              }}
            >
              🔄 Refresh Status
            </button>
            <button
              class="btn btn-secondary"
              onClick={() => {
                invokeCommand('get_cache_stats')
                  .then((stats: any) => {
                    const msg = `Cache: ${stats.hit_count || 0} hits, ${stats.miss_count || 0} misses, ${Math.round((stats.size_bytes || 0) / 1024)}KB`;
                    setSuccessMessage(msg);
                    setTimeout(() => setSuccessMessage(null), 5000);
                  })
                  .catch(() => setError('Failed to get cache stats'));
              }}
            >
              📊 View Cache Stats
            </button>
            <button
              class="btn btn-secondary"
              onClick={cleanupExpiredCache}
              disabled={cleaningCache()}
              title="Remove expired cache entries"
            >
              {cleaningCache() ? '⏳ Cleaning...' : '🧹 Cleanup Old Cache'}
            </button>
            <button class="btn btn-secondary" onClick={exportConfig}>
              📋 Export Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformConfig;