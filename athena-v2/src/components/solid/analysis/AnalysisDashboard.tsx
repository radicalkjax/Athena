import { Component, For, Show, createSignal, lazy, onCleanup } from 'solid-js';
import { AIProviderStatus } from '../providers/AIProviderStatus';
import { WasmErrorBoundary } from '../ErrorBoundary';
import type { WasmAnalysisResult } from '../../../types/wasm';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Lazy load heavy components
const WasmBridge = lazy(() => import('../wasm/WasmBridge'));

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
  filePath?: string;
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
  const [, setWasmResults] = createSignal<Record<string, WasmAnalysisResult>>({});

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

  const startAnalysis = async () => {
    if (!props.filePath) {
      console.error('No file path provided for analysis');
      return;
    }

    const filePath = props.filePath;

    // Run analysis stages sequentially
    try {
      // Stage 1: Static Analysis
      await runStaticAnalysis(filePath);

      // Stage 2: Dynamic Analysis (Sandbox)
      await runDynamicAnalysis(filePath);

      // Stage 3: Network Analysis
      await runNetworkAnalysis(filePath);

      // Stage 4: Behavioral Analysis (Pattern Matching)
      await runBehavioralAnalysis(filePath);

    } catch (error) {
      console.error('Analysis pipeline error:', error);
    }
  };

  const runStaticAnalysis = async (filePath: string) => {
    updateStageStatus('static', 'running', 0);

    try {
      // Call backend command for static file analysis
      const result = await invoke<any>('analyze_file', { filePath });

      // Extract findings from the analysis result
      const findings: string[] = [];

      if (result.anomalies && result.anomalies.length > 0) {
        findings.push(`Found ${result.anomalies.length} anomalies`);
      }

      if (result.imports && result.imports.length > 0) {
        const suspicious = result.imports.filter((imp: any) => imp.suspicious);
        if (suspicious.length > 0) {
          findings.push(`Detected ${suspicious.length} suspicious imports`);
        }
      }

      if (result.entropy > 7.0) {
        findings.push(`High entropy detected: ${result.entropy.toFixed(2)} (possible packing)`);
      }

      if (result.sections && result.sections.length > 0) {
        const suspiciousSections = result.sections.filter((s: any) => s.suspicious);
        if (suspiciousSections.length > 0) {
          findings.push(`${suspiciousSections.length} suspicious sections found`);
        }
      }

      updateStageStatus('static', 'completed', 100, findings.length > 0 ? findings : ['No issues detected']);
    } catch (error) {
      console.error('Static analysis failed:', error);
      updateStageStatus('static', 'error', 0, [`Error: ${error}`]);
    }
  };

  const runDynamicAnalysis = async (filePath: string) => {
    updateStageStatus('dynamic', 'running', 0);

    try {
      // Check if sandbox is available
      const sandboxAvailable = await invoke<boolean>('check_sandbox_available');

      if (!sandboxAvailable) {
        updateStageStatus('dynamic', 'completed', 100, ['Sandbox not available - Docker required']);
        return;
      }

      // Progress update
      updateStageStatus('dynamic', 'running', 30);

      // Execute sample in sandbox
      const report = await invoke<any>('execute_sample_in_sandbox', {
        filePath,
        timeoutSecs: 30,
        captureNetwork: sandboxConfig().networkIsolation
      });

      // Extract findings from execution report
      const findings: string[] = [];

      if (report.behavior_events && report.behavior_events.length > 0) {
        findings.push(`Captured ${report.behavior_events.length} behavior events`);
      }

      if (report.file_operations && report.file_operations.length > 0) {
        findings.push(`Observed ${report.file_operations.length} file operations`);
      }

      if (report.network_connections && report.network_connections.length > 0) {
        findings.push(`Detected ${report.network_connections.length} network connections`);
      }

      if (report.processes && report.processes.length > 1) {
        findings.push(`Spawned ${report.processes.length - 1} child processes`);
      }

      if (report.mitre_techniques && report.mitre_techniques.length > 0) {
        findings.push(`Matched ${report.mitre_techniques.length} MITRE ATT&CK techniques`);
      }

      updateStageStatus('dynamic', 'completed', 100, findings.length > 0 ? findings : ['No suspicious behavior detected']);
    } catch (error) {
      console.error('Dynamic analysis failed:', error);
      updateStageStatus('dynamic', 'error', 0, [`Error: ${error}`]);
    }
  };

  const runNetworkAnalysis = async (filePath: string) => {
    updateStageStatus('network', 'running', 0);

    try {
      // For network analysis, we'll analyze if the file contains network-related artifacts
      // This is a simplified version - real implementation would capture actual traffic

      const result = await invoke<any>('analyze_file', { filePath });

      const findings: string[] = [];

      // Check imports for network functions
      if (result.imports) {
        const networkImports = result.imports.filter((imp: any) =>
          imp.library.toLowerCase().includes('ws2_32') ||
          imp.library.toLowerCase().includes('wininet') ||
          imp.library.toLowerCase().includes('winhttp') ||
          imp.functions.some((fn: string) =>
            fn.toLowerCase().includes('socket') ||
            fn.toLowerCase().includes('connect') ||
            fn.toLowerCase().includes('send') ||
            fn.toLowerCase().includes('recv')
          )
        );

        if (networkImports.length > 0) {
          findings.push(`Found ${networkImports.length} network-related libraries`);
        }
      }

      // Check strings for URLs/IPs
      if (result.strings) {
        const urlPattern = /https?:\/\/[^\s]+/i;
        const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

        const urls = result.strings.filter((s: any) => urlPattern.test(s.value));
        const ips = result.strings.filter((s: any) => ipPattern.test(s.value));

        if (urls.length > 0) {
          findings.push(`Extracted ${urls.length} URLs from binary`);
        }

        if (ips.length > 0) {
          findings.push(`Found ${ips.length} IP addresses`);
        }
      }

      updateStageStatus('network', 'completed', 100, findings.length > 0 ? findings : ['No network indicators found']);
    } catch (error) {
      console.error('Network analysis failed:', error);
      updateStageStatus('network', 'error', 0, [`Error: ${error}`]);
    }
  };

  const runBehavioralAnalysis = async (filePath: string) => {
    updateStageStatus('behavioral', 'running', 0);

    try {
      // Use YARA scanner for pattern-based behavioral detection
      const result = await invoke<any>('scan_file_with_yara', { filePath });

      const findings: string[] = [];

      if (result.matches && result.matches.length > 0) {
        findings.push(`Matched ${result.matches.length} YARA rules`);

        // Group by severity/category
        const criticalMatches = result.matches.filter((m: any) =>
          m.rule_name.toLowerCase().includes('ransomware') ||
          m.rule_name.toLowerCase().includes('backdoor') ||
          m.rule_name.toLowerCase().includes('trojan')
        );

        if (criticalMatches.length > 0) {
          findings.push(`CRITICAL: ${criticalMatches.length} high-severity threats detected`);
        }
      }

      if (result.scan_time_ms) {
        findings.push(`Scan completed in ${result.scan_time_ms}ms`);
      }

      updateStageStatus('behavioral', 'completed', 100, findings.length > 0 ? findings : ['No malicious patterns detected']);
    } catch (error) {
      console.error('Behavioral analysis failed:', error);
      updateStageStatus('behavioral', 'error', 0, [`Error: ${error}`]);
    }
  };

  const updateStageStatus = (
    stageId: string,
    status: 'pending' | 'running' | 'completed' | 'error',
    progress: number,
    findings?: string[]
  ) => {
    setStages(prev => prev.map(stage =>
      stage.id === stageId
        ? {
            ...stage,
            status,
            progress,
            ...(findings && { findings })
          }
        : stage
    ));
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
                      onClick={() => setSelectedAnalysisType(stage.id as 'static' | 'dynamic' | 'network' | 'behavioral')}
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