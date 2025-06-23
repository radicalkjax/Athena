import { Component, For, Show, createSignal } from 'solid-js';
import { AIProviderStatus } from '../providers/AIProviderStatus';
import WasmBridge from '../wasm/WasmBridge';
import { WasmErrorBoundary } from '../ErrorBoundary';
import AIEnsemble from './AIEnsemble';
import type { WasmAnalysisResult } from '../../../types/wasm';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';

interface AnalysisStage {
  id: string;
  name: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  findings: string[];
}

interface Props {
  fileData?: Uint8Array;
}

export const AnalysisDashboard: Component<Props> = (props) => {
  const [stages, setStages] = createSignal<AnalysisStage[]>([
    {
      id: 'static',
      name: 'Static Analysis',
      icon: '🔍',
      status: 'pending',
      progress: 0,
      findings: []
    },
    {
      id: 'dynamic',
      name: 'Dynamic Analysis',
      icon: '⚡',
      status: 'pending',
      progress: 0,
      findings: []
    },
    {
      id: 'network',
      name: 'Network Analysis',
      icon: '🌐',
      status: 'pending',
      progress: 0,
      findings: []
    },
    {
      id: 'behavioral',
      name: 'Behavioral Analysis',
      icon: '🧠',
      status: 'pending',
      progress: 0,
      findings: []
    }
  ]);

  const [sandboxConfig, setSandboxConfig] = createSignal({
    os: 'windows',
    architecture: 'x64',
    networkIsolation: true,
    snapshotEnabled: true
  });

  const [selectedAnalysisType, setSelectedAnalysisType] = createSignal<'static' | 'dynamic' | 'network' | 'behavioral'>('static');
  const [wasmResults, setWasmResults] = createSignal<Record<string, WasmAnalysisResult>>({});

  const handleWasmAnalysisComplete = (type: string, result: WasmAnalysisResult) => {
    setWasmResults(prev => ({ ...prev, [type]: result }));
    
    // Update stage with WASM results
    setStages(prev => prev.map(stage => 
      stage.id === type 
        ? { 
            ...stage, 
            status: 'completed' as const,
            progress: 100,
            findings: result.findings.map(f => `[${f.severity.toUpperCase()}] ${f.description}`)
          }
        : stage
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--success-color)';
      case 'running': return 'var(--warning-color)';
      case 'error': return 'var(--danger-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const startAnalysis = () => {
    // Simulate analysis progression
    let currentStage = 0;
    
    const runStage = () => {
      if (currentStage >= stages().length) return;
      
      setStages(prev => prev.map((stage, idx) => {
        if (idx === currentStage) {
          return { ...stage, status: 'running', progress: 0 };
        }
        return stage;
      }));
      
      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        
        setStages(prev => prev.map((stage, idx) => {
          if (idx === currentStage) {
            if (progress >= 100) {
              clearInterval(progressInterval);
              currentStage++;
              setTimeout(runStage, 500);
              return {
                ...stage,
                status: 'completed',
                progress: 100,
                findings: [
                  `Found ${Math.floor(Math.random() * 10) + 1} suspicious API calls`,
                  `Detected ${Math.floor(Math.random() * 5) + 1} potential vulnerabilities`,
                  `Identified ${Math.floor(Math.random() * 3) + 1} IoCs`
                ]
              };
            }
            return { ...stage, progress };
          }
          return stage;
        }));
      }, 200);
    };
    
    runStage();
  };

  return (
    <div class="content-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <h2 style="color: var(--barbie-pink); margin: 0;">
          🎯 Malware Analysis Dashboard
        </h2>
        <button
          class="btn btn-primary"
          onClick={startAnalysis}
        >
          🚀 Start Full Analysis
        </button>
      </div>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel title="Analysis Pipeline" icon="🔄">
            <div style="display: grid; gap: 15px;">
              <For each={stages()}>
                {(stage) => (
                  <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">{stage.icon}</span>
                        <h4 style="margin: 0; color: var(--text-primary);">{stage.name}</h4>
                      </div>
                      <span 
                        style={`padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: ${getStatusColor(stage.status)}20; color: ${getStatusColor(stage.status)}`}
                      >
                        {stage.status}
                      </span>
                    </div>
                
                    <Show when={stage.status === 'running' || stage.status === 'completed'}>
                      <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                          <span style="font-size: 0.85rem; color: var(--text-secondary);">Progress</span>
                          <span style="font-size: 0.85rem; color: var(--barbie-pink); font-weight: 600;">{stage.progress}%</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: var(--panel-bg); border-radius: 4px; overflow: hidden;">
                          <div 
                            style={`width: ${stage.progress}%; height: 100%; background: linear-gradient(90deg, var(--barbie-pink) 0%, #ff8fab 100%); transition: width 0.3s ease;`}
                          ></div>
                        </div>
                      </div>
                    </Show>
                
                    <Show when={stage.findings.length > 0}>
                      <div style="background: var(--panel-bg); padding: 15px; border-radius: 6px;">
                        <h5 style="margin: 0 0 10px 0; color: var(--barbie-pink); font-size: 0.9rem;">Findings:</h5>
                        <ul style="margin: 0; padding-left: 20px; list-style: none;">
                          <For each={stage.findings}>
                            {(finding) => <li style="padding: 4px 0; font-size: 0.85rem; color: var(--text-secondary);">• {finding}</li>}
                          </For>
                        </ul>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </AnalysisPanel>
        </div>

        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🖥️ Sandbox Configuration
          </h3>
          
          <div style="background: var(--panel-bg); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: grid; gap: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: var(--text-secondary);">Operating System:</label>
                <select 
                  value={sandboxConfig().os}
                  onChange={(e) => setSandboxConfig(prev => ({ ...prev, os: e.target.value }))}
                  style="width: 100%; padding: 8px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                >
                  <option value="windows">Windows 10</option>
                  <option value="linux">Ubuntu 22.04</option>
                  <option value="macos">macOS Ventura</option>
                </select>
              </div>
              
              <div>
                <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: var(--text-secondary);">Architecture:</label>
                <select 
                  value={sandboxConfig().architecture}
                  onChange={(e) => setSandboxConfig(prev => ({ ...prev, architecture: e.target.value }))}
                  style="width: 100%; padding: 8px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                >
                  <option value="x64">x64</option>
                  <option value="x86">x86</option>
                  <option value="arm64">ARM64</option>
                </select>
              </div>
              
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked={sandboxConfig().networkIsolation}
                  onChange={(e) => setSandboxConfig(prev => ({ ...prev, networkIsolation: e.target.checked }))}
                  style="width: 16px; height: 16px; accent-color: var(--barbie-pink);"
                />
                <span style="font-size: 0.9rem;">Network Isolation</span>
              </label>
              
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked={sandboxConfig().snapshotEnabled}
                  onChange={(e) => setSandboxConfig(prev => ({ ...prev, snapshotEnabled: e.target.checked }))}
                  style="width: 16px; height: 16px; accent-color: var(--barbie-pink);"
                />
                <span style="font-size: 0.9rem;">Enable Snapshots</span>
              </label>
            </div>
          </div>

          <Show when={props.fileData}>
            <div style="margin-top: 20px;">
              <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
                🚀 WASM Analysis Engine
              </h3>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                <For each={stages()}>
                  {(stage) => (
                    <button
                      class={`btn ${selectedAnalysisType() === stage.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSelectedAnalysisType(stage.id as any)}
                      style="font-size: 0.85rem; padding: 8px 12px;"
                    >
                      {stage.icon} {stage.name}
                    </button>
                  )}
                </For>
              </div>
              <div style="background: var(--panel-bg); padding: 15px; border-radius: 8px;">
                <WasmErrorBoundary>
                  <WasmBridge
                    fileData={props.fileData}
                    analysisType={selectedAnalysisType()}
                    onAnalysisComplete={(result) => handleWasmAnalysisComplete(selectedAnalysisType(), result)}
                  />
                </WasmErrorBoundary>
              </div>
            </div>
          </Show>
          
          <div style="margin-top: 20px;">
            <AIProviderStatus />
          </div>
        </div>
      </div>
    </div>
  );
};