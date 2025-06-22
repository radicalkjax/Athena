import { Component, For, createSignal, onMount } from 'solid-js';

interface AIProvider {
  name: string;
  model: string;
  status: 'ready' | 'analyzing' | 'error' | 'offline';
}

export const AIProviderStatus: Component = () => {
  const [providers, setProviders] = createSignal<AIProvider[]>([
    { name: 'Claude', model: 'claude-3-opus', status: 'ready' },
    { name: 'GPT-4', model: 'gpt-4-turbo', status: 'ready' },
    { name: 'DeepSeek', model: 'deepseek-v2', status: 'ready' },
    { name: 'Gemini', model: 'gemini-pro', status: 'ready' },
    { name: 'Mistral', model: 'mistral-large', status: 'ready' },
    { name: 'Llama', model: 'llama-3-70b', status: 'ready' },
  ]);

  // Simulate status updates
  onMount(() => {
    const interval = setInterval(() => {
      setProviders(prev => prev.map(provider => ({
        ...provider,
        status: Math.random() > 0.7 ? 'analyzing' : 'ready',
      })));
    }, 3000);

    return () => clearInterval(interval);
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