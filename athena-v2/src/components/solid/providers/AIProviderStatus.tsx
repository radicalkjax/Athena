import { Component, For, createSignal, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import type { AIProviderStatus as ProviderStatus } from '../../../types/ai';

interface AIProviderDisplay {
  name: string;
  model: string;
  status: 'ready' | 'analyzing' | 'error' | 'offline';
  queueLength?: number;
  latency?: number | null;
}

// Ordered list of providers for consistent display
const PROVIDER_ORDER = ['claude', 'openai', 'deepseek', 'gemini', 'mistral', 'llama'];

// Map backend provider names to display names and models
const PROVIDER_INFO: Record<string, { displayName: string; model: string }> = {
  claude: { displayName: 'Claude', model: 'claude-3-opus' },
  openai: { displayName: 'GPT', model: 'gpt-4-turbo' },
  deepseek: { displayName: 'DeepSeek', model: 'deepseek-v2' },
  gemini: { displayName: 'Gemini', model: 'gemini-pro' },
  mistral: { displayName: 'Mistral', model: 'mistral-large' },
  llama: { displayName: 'Llama', model: 'llama-3-70b' },
};

export const AIProviderStatus: Component = () => {
  const [providers, setProviders] = createSignal<AIProviderDisplay[]>([]);

  // Fetch real provider status from backend
  const fetchProviderStatus = async () => {
    try {
      const statusMap = await invoke<Record<string, ProviderStatus>>('get_ai_provider_status');

      // Convert backend status to display format, maintaining consistent order
      const displayProviders: AIProviderDisplay[] = PROVIDER_ORDER
        .map(key => {
          const status = statusMap[key];
          const info = PROVIDER_INFO[key] ?? { displayName: key, model: 'unknown' };

          // Determine visual status based on backend state
          let displayStatus: 'ready' | 'analyzing' | 'error' | 'offline' = 'offline';

          if (!status) {
            displayStatus = 'offline';
          } else if (!status.configured) {
            displayStatus = 'offline';
          } else if (!status.enabled) {
            displayStatus = 'offline';
          } else if (!status.healthy) {
            displayStatus = 'error';
          } else if (status.queue_length > 0) {
            displayStatus = 'analyzing';
          } else if (status.circuit_state === 'open') {
            displayStatus = 'error';
          } else {
            displayStatus = 'ready';
          }

          return {
            name: info.displayName,
            model: info.model,
            status: displayStatus,
            queueLength: status?.queue_length,
            latency: status?.avg_latency_ms,
          };
        });

      setProviders(displayProviders);
    } catch (error) {
      console.error('Failed to fetch AI provider status:', error);
      // Keep existing state on error, or set to offline if no state
      if (providers().length === 0) {
        // Initialize with offline state if first fetch fails
        setProviders(
          PROVIDER_ORDER.map(key => {
            const info = PROVIDER_INFO[key] ?? { displayName: key, model: 'unknown' };
            return {
              name: info.displayName,
              model: info.model,
              status: 'offline' as const,
            };
          })
        );
      }
    }
  };

  onMount(() => {
    // Initial fetch
    fetchProviderStatus();

    // Poll every 5 seconds for status updates
    const interval = setInterval(fetchProviderStatus, 5000);

    onCleanup(() => clearInterval(interval));
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'var(--success-color)';
      case 'analyzing': return 'var(--warning-color)';
      case 'error': return 'var(--danger-color)';
      case 'offline': return 'var(--text-secondary)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div class="ensemble-status">
      <div class="ensemble-header">
        <span>🤖</span>
        AI Ensemble Status
      </div>
      <div class="agent-status-grid">
        <For each={providers()}>
          {(provider) => (
            <div class="agent-status">
              <span
                class={`agent-status-dot ${provider.status === 'analyzing' ? 'analyzing' : ''}`}
                style={`background-color: ${getStatusColor(provider.status)}`}
              ></span>
              <span>{provider.name}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};