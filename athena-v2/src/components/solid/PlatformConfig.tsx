import { Component, createSignal, For } from 'solid-js';
import AnalysisPanel from './shared/AnalysisPanel';
import { StatCard } from './shared/StatCard';
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

const PlatformConfig: Component = () => {
  const [aiProviders, setAiProviders] = createSignal<AIProviderConfig[]>([
    {
      id: 'claude',
      name: 'Anthropic Claude',
      icon: '🤖',
      enabled: true,
      model: 'claude-3-5-sonnet-20241022',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      icon: '🧠',
      enabled: true,
      model: 'gpt-4-turbo-preview',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['gpt-4-turbo-preview', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      icon: '🔍',
      enabled: true,
      model: 'deepseek-v3',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['deepseek-v3', 'deepseek-coder-v2', 'deepseek-chat']
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      icon: '🌟',
      enabled: true,
      model: 'gemini-pro',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['gemini-pro', 'gemini-pro-vision']
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      icon: '🌊',
      enabled: false,
      model: 'mistral-large',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['mistral-large', 'mistral-medium', 'mistral-small']
    },
    {
      id: 'llama',
      name: 'Meta Llama',
      icon: '🦙',
      enabled: false,
      model: 'llama-3-70b',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.1,
      models: ['llama-3-70b', 'llama-3-8b', 'code-llama-34b']
    }
  ]);

  const [deploymentTargets, setDeploymentTargets] = createSignal([
    { id: 'fermyon', name: 'Fermyon Cloud (Global Edge)', enabled: true },
    { id: 'wasmcloud', name: 'wasmCloud Lattice (Distributed)', enabled: true },
    { id: 'k8s', name: 'Kubernetes + WASM Runtime', enabled: false },
    { id: 'self', name: 'Self-hosted Edge Nodes', enabled: false }
  ]);

  const [ensembleSettings, setEnsembleSettings] = createSignal({
    consensusVoting: true,
    weightByConfidence: true,
    crossValidation: true,
    consensusThreshold: 75
  });

  const updateProviderConfig = (id: string, field: keyof AIProviderConfig, value: any) => {
    setAiProviders(providers => 
      providers.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  const toggleDeploymentTarget = (id: string) => {
    setDeploymentTargets(targets =>
      targets.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    );
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🛠️ WASM Platform Configuration
      </h2>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Configure runtime environment and AI providers</p>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel title="Runtime Environment" icon="🏗️" className="scrollable-panel">
            <div style="padding: 0 20px 20px 20px;">
              <div style="margin-bottom: 20px;">
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Spin Runtime Version:</span>
                  <span style="color: var(--barbie-pink); font-weight: 600;">2.0.1</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">WASI Preview:</span>
                  <span style="color: var(--barbie-pink); font-weight: 600;">2.0</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Component Model:</span>
                  <span style="color: var(--success-color); font-weight: 600;">Enabled</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Cold Start Time:</span>
                  <span style="color: var(--info-color); font-weight: 600;">&lt; 1μs</span>
                </div>
                <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                  <span style="color: var(--text-secondary);">Memory Limit:</span>
                  <span style="color: var(--warning-color); font-weight: 600;">2GB</span>
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
                <span style="color: var(--text-secondary);">WASI-NN Backend:</span>
                <span style="color: var(--barbie-pink); font-weight: 600;">ONNX + TensorFlow</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">WebLLM Engine:</span>
                <span style="color: var(--success-color); font-weight: 600;">WebGPU Enabled</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Hardware Acceleration:</span>
                <span style="color: var(--info-color); font-weight: 600;">GPU + TPU</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Model Cache:</span>
                <span style="color: var(--warning-color); font-weight: 600;">4GB</span>
              </div>
              <div class="config-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                <span style="color: var(--text-secondary);">Ensemble Mode:</span>
                <span style="color: var(--success-color); font-weight: 600;">Consensus Voting</span>
              </div>
            </div>
          
            <h4 style="color: var(--barbie-pink); margin-bottom: 15px;">Active AI Providers</h4>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <For each={aiProviders()}>
                {(provider) => (
                  <div style="background: var(--code-bg); padding: 15px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                      <strong style="color: var(--barbie-pink); font-size: 1.1rem;">
                        <span style="margin-right: 8px;">{provider.icon}</span>
                        {provider.name}
                      </strong>
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
                        <select 
                          value={provider.model}
                          onChange={(e) => updateProviderConfig(provider.id, 'model', e.currentTarget.value)}
                          style="width: 100%; padding: 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; color: var(--text-primary);"
                        >
                          <For each={provider.models}>
                            {(model) => <option value={model}>{model}</option>}
                          </For>
                        </select>
                      </div>
                      
                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">API Key:</label>
                        <input 
                          type="password" 
                          placeholder="sk-..."
                          value={provider.apiKey}
                          onChange={(e) => updateProviderConfig(provider.id, 'apiKey', e.currentTarget.value)}
                          style="width: 100%; padding: 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; color: var(--text-primary);"
                        />
                      </div>
                      
                      <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Max Tokens:</label>
                        <input 
                          type="number" 
                          value={provider.maxTokens}
                          onChange={(e) => updateProviderConfig(provider.id, 'maxTokens', parseInt(e.currentTarget.value))}
                          style="width: 100%; padding: 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; color: var(--text-primary);"
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
                          style="width: 100%; padding: 8px; background: var(--panel-bg); border: 1px solid var(--accent-bg); border-radius: 4px; color: var(--text-primary);"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <h4 style="color: var(--barbie-pink); margin-top: 20px; margin-bottom: 15px;">Ensemble Settings</h4>
            <div style="background: var(--code-bg); padding: 15px; border-radius: 6px; margin-bottom: 20px;">
              <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked={ensembleSettings().consensusVoting}
                  onChange={(e) => setEnsembleSettings({...ensembleSettings(), consensusVoting: e.currentTarget.checked})}
                  style="margin-right: 10px;"
                />
                <span>Enable consensus voting</span>
              </label>
              <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked={ensembleSettings().weightByConfidence}
                  onChange={(e) => setEnsembleSettings({...ensembleSettings(), weightByConfidence: e.currentTarget.checked})}
                  style="margin-right: 10px;"
                />
                <span>Weight responses by model confidence</span>
              </label>
              <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked={ensembleSettings().crossValidation}
                  onChange={(e) => setEnsembleSettings({...ensembleSettings(), crossValidation: e.currentTarget.checked})}
                  style="margin-right: 10px;"
                />
                <span>Enable model cross-validation</span>
              </label>
              <div>
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary);">Minimum Consensus Threshold: {ensembleSettings().consensusThreshold}%</label>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={ensembleSettings().consensusThreshold}
                  onChange={(e) => setEnsembleSettings({...ensembleSettings(), consensusThreshold: parseInt(e.currentTarget.value)})}
                  style="width: 100%;"
                />
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 Platform Monitoring
          </h3>
          
          <div class="stats-overview">
            <StatCard 
              label="Platform Uptime"
              value="99.8%"
            />
            <StatCard 
              label="Providers Online"
              value="6/6"
            />
            <StatCard 
              label="Memory Usage"
              value="142MB"
            />
            <StatCard 
              label="CPU Utilization"
              value="23%"
            />
          </div>
          
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🎬 Actions
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary">🚀 Deploy Configuration</button>
            <button class="btn btn-secondary">🔄 Restart Platform</button>
            <button class="btn btn-secondary">📊 View Metrics</button>
            <button class="btn btn-secondary">📋 Export Config</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformConfig;