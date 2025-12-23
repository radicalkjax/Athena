import { Component, createSignal, Show, For, onMount, createEffect } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import { invokeCommand } from '../../../utils/tauriCompat';
import type { MemoryRegion, ExtractedString } from '../../../types/memoryAnalysis';
import type { ProcessInfo, NetworkInfo, VolatilityStatus, SystemStatus, CpuInfo, MemoryInfo } from '../../../types/system';
import './MemoryAnalysis.css';

interface MemoryProcess {
  pid: number;
  name: string;
  path: string;
  parentPid: number;
  threads: number;
  handles: number;
  virtualSize: number;
  workingSet: number;
  injected: boolean;
  hidden: boolean;
  suspicious: boolean;
}

interface MemoryString {
  offset: number;
  value: string;
  encoding: string;
  context: string;
}

interface MemoryRegion {
  address: string;
  size: number;
  protection: string;
  type: string;
  suspicious: boolean;
  entropy: number;
}

interface MemoryDump {
  timestamp: number;
  processes: MemoryProcess[];
  strings: MemoryString[];
  regions: MemoryRegion[];
  artifacts: {
    urls: string[];
    ips: string[];
    mutexes: string[];
    registryKeys: string[];
    files: string[];
  };
}

interface VolatilityResult {
  processes?: any[];
  network_connections?: any[];
  loaded_modules?: any[];
  registry_hives?: any[];
  injected_code?: any[];
  summary?: string;
}

interface ProcessTreeNode {
  pid: number;
  name: string;
  parent_pid: number;
  children: ProcessTreeNode[];
  depth: number;
}

interface NetworkConnectionGroup {
  destination: string;
  port: number;
  protocol: string;
  connection_count: number;
  total_bytes: number;
  processes: string[];
}

const MemoryAnalysis: Component = () => {
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [memoryDump, setMemoryDump] = createSignal<MemoryDump | null>(null);
  const [activeView, setActiveView] = createSignal<'processes' | 'strings' | 'regions' | 'artifacts'>('processes');
  const [filterSuspicious] = createSignal(false);
  const [searchTerm] = createSignal('');
  const [systemInfo, setSystemInfo] = createSignal<SystemStatus | null>(null);
  const [cpuInfo, setCpuInfo] = createSignal<CpuInfo | null>(null);
  const [memoryInfo, setMemoryInfo] = createSignal<MemoryInfo | null>(null);
  const [refreshInterval, setRefreshInterval] = createSignal<number | null>(null);

  // Memory tools state
  const [isRunningTool, setIsRunningTool] = createSignal<string | null>(null);
  const [volatilityAvailable, setVolatilityAvailable] = createSignal<boolean | null>(null);
  const [volatilityResult, setVolatilityResult] = createSignal<VolatilityResult | null>(null);
  const [processTree, setProcessTree] = createSignal<ProcessTreeNode[]>([]);
  const [networkConnections, setNetworkConnections] = createSignal<NetworkConnectionGroup[]>([]);
  const [toolError, setToolError] = createSignal<string | null>(null);
  const [activeToolView, setActiveToolView] = createSignal<'volatility' | 'process-tree' | 'network' | 'crypto' | null>(null);
  const [currentDumpPath, setCurrentDumpPath] = createSignal<string | null>(null);

  onMount(async () => {
    // Get initial system status
    await fetchSystemStatus();

    // Set up refresh interval (cast to number for browser compatibility)
    const interval = setInterval(fetchSystemStatus, 2000) as unknown as number;
    setRefreshInterval(interval);

    return () => {
      const currentInterval = refreshInterval();
      if (currentInterval !== null) clearInterval(currentInterval);
    };
  });

  const fetchSystemStatus = async () => {
    try {
      const [status, cpu, memory] = await Promise.all([
        invokeCommand('get_system_status'),
        invokeCommand('get_cpu_info'),
        invokeCommand('get_memory_info')
      ]);
      
      setSystemInfo(status);
      setCpuInfo(cpu);
      setMemoryInfo(memory);
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  };

  // Watch for file changes to update memory view
  createEffect(() => {
    const files = analysisStore.files();
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      if (latestFile && latestFile.analysisResult) {
        updateMemoryDataFromAnalysis(latestFile.analysisResult);
      }
    }
  });

  const loadMemoryDump = async () => {
    setIsAnalyzing(true);
    try {
      // Use Tauri file dialog to select dump file
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Memory Dumps', extensions: ['dmp', 'raw', 'bin', 'mem', 'vmem'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!selected) {
        return; // User cancelled
      }

      const filePath = typeof selected === 'string' ? selected : selected[0];

      // Extract strings and regions from the dump file
      const [regions, strings] = await Promise.all([
        invokeCommand<MemoryRegion[]>('get_memory_regions', { filePath }),
        invokeCommand<ExtractedString[]>('extract_strings_from_dump', { filePath, minLength: 4, encoding: 'both' })
      ]);

      // Build memory dump from real data
      setMemoryDump({
        timestamp: Date.now() / 1000,
        processes: [],
        strings: strings.map((s) => ({
          offset: s.offset || 0,
          value: s.value || '',
          encoding: s.encoding || 'ASCII',
          context: s.category || categorizeString(s.value || '')
        })),
        regions: regions.map((r) => ({
          address: `0x${r.start_address.toString(16)}`,
          size: r.size || 0,
          protection: r.permissions || 'unknown',
          type: r.region_type || 'mapped',
          suspicious: false,
          entropy: 0
        })),
        artifacts: {
          urls: [],
          ips: [],
          mutexes: [],
          registryKeys: [],
          files: []
        }
      });
    } catch (err) {
      console.error('Failed to load memory dump:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeMemory = async () => {
    setIsAnalyzing(true);

    try {
      const currentFile = analysisStore.currentFile;
      if (!currentFile?.path) {
        throw new Error('No file selected for analysis');
      }

      // Get real memory regions from backend
      const [regions, fileAnalysis] = await Promise.all([
        invokeCommand<MemoryRegion[]>('get_memory_regions', { filePath: currentFile.path }),
        invokeCommand('analyze_file_with_wasm', { filePath: currentFile.path })
      ]);

      // Build memory dump from real data
      setMemoryDump({
        timestamp: Date.now() / 1000,
        processes: [], // Process list from system monitoring
        strings: [],
        regions: regions.map((r) => ({
          address: `0x${r.start_address.toString(16)}`,
          size: r.size || 0,
          protection: r.permissions || 'unknown',
          type: r.region_type || 'mapped',
          suspicious: false,
          entropy: 0
        })),
        artifacts: {
          urls: [],
          ips: [],
          mutexes: [],
          registryKeys: [],
          files: []
        }
      });

      // Update with file analysis data
      updateMemoryDataFromAnalysis(fileAnalysis);
    } catch (err) {
      console.error('Memory analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateMemoryDataFromAnalysis = (result: any) => {
    // Extract memory-relevant data from analysis
    if (result.strings) {
      const suspiciousStrings = result.strings.suspicious || [];
      // Update memory dump strings
      setMemoryDump(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          strings: suspiciousStrings.slice(0, 20).map((str: string, idx: number) => ({
            offset: 0x00400000 + idx * 0x1000,
            value: str,
            encoding: 'UTF-8',
            context: categorizeString(str)
          }))
        };
      });
    }
  };

  const categorizeString = (str: string): string => {
    if (str.match(/https?:\/\//i)) return 'Network communication';
    if (str.match(/SELECT|INSERT|UPDATE|DELETE/i)) return 'Database query';
    if (str.match(/cmd\.exe|powershell|bash/i)) return 'Command execution';
    if (str.match(/[A-Z]:\\|\\\\|\//)) return 'File path';
    if (str.match(/HKLM|HKCU|Software/)) return 'Registry key';
    return 'Data';
  };

  // Memory Tools Handlers
  const runVolatilityAnalysis = async () => {
    setIsRunningTool('volatility');
    setToolError(null);
    setActiveToolView('volatility');

    try {
      // First check if Volatility is available
      const status = await invokeCommand<VolatilityStatus>('check_volatility_available');
      setVolatilityAvailable(status.available);

      if (!status.available) {
        setToolError('Volatility 3 is not installed. Install with: pip install volatility3');
        return;
      }

      // Need a memory dump file to analyze
      const dumpPath = currentDumpPath();
      if (!dumpPath) {
        // Prompt user to load a dump file first
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          filters: [
            { name: 'Memory Dumps', extensions: ['dmp', 'raw', 'bin', 'mem', 'vmem'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!selected) {
          setToolError('Please select a memory dump file');
          return;
        }

        const filePath = typeof selected === 'string' ? selected : selected[0];
        setCurrentDumpPath(filePath);

        // Run Volatility analysis
        const result = await invokeCommand('analyze_memory_with_volatility', {
          dumpPath: filePath,
          plugins: ['pslist', 'netscan', 'malfind']
        }) as VolatilityResult;

        setVolatilityResult(result);
      } else {
        // Run Volatility on existing dump
        const result = await invokeCommand('analyze_memory_with_volatility', {
          dumpPath,
          plugins: ['pslist', 'netscan', 'malfind']
        }) as VolatilityResult;

        setVolatilityResult(result);
      }
    } catch (err) {
      console.error('Volatility analysis failed:', err);
      setToolError(err instanceof Error ? err.message : 'Volatility analysis failed');
    } finally {
      setIsRunningTool(null);
    }
  };

  const showProcessTree = async () => {
    setIsRunningTool('process-tree');
    setToolError(null);
    setActiveToolView('process-tree');

    try {
      // Get current processes from system
      const processes = await invokeCommand<ProcessInfo[]>('get_processes');

      // Build process tree
      const tree = await invokeCommand<ProcessTreeNode[]>('get_process_tree', {
        processes: processes.map(p => ({
          pid: p.pid,
          name: p.name,
          parent_pid: p.parent_pid || p.ppid || 0,
          command_line: p.cmd?.join(' ') || p.command?.join(' ') || ''
        }))
      });

      setProcessTree(tree);
    } catch (err) {
      console.error('Process tree failed:', err);
      setToolError(err instanceof Error ? err.message : 'Failed to build process tree');
    } finally {
      setIsRunningTool(null);
    }
  };

  const analyzeNetworkConnections = async () => {
    setIsRunningTool('network');
    setToolError(null);
    setActiveToolView('network');

    try {
      // Get network info from system
      const networkInfo = await invokeCommand<NetworkInfo[]>('get_network_info');

      // Analyze connections if we have sandbox results
      if (memoryDump()?.artifacts?.ips?.length) {
        // Build connection data from artifacts
        const connections = memoryDump()!.artifacts.ips.map((ip, idx) => ({
          source_ip: '127.0.0.1',
          source_port: 49152 + idx,
          dest_ip: ip,
          dest_port: 443,
          protocol: 'TCP',
          process_name: 'unknown',
          bytes_sent: 0,
          bytes_received: 0
        }));

        const grouped = await invokeCommand<NetworkConnectionGroup[]>('analyze_network_connections', {
          connections
        });

        setNetworkConnections(grouped);
      } else {
        // Show system network connections - extract from first interface if available
        const connections = networkInfo[0]?.connections || [];
        setNetworkConnections([]);
      }
    } catch (err) {
      console.error('Network analysis failed:', err);
      setToolError(err instanceof Error ? err.message : 'Network analysis failed');
    } finally {
      setIsRunningTool(null);
    }
  };

  const runCryptoAnalysis = async () => {
    setIsRunningTool('crypto');
    setToolError(null);
    setActiveToolView('crypto');

    try {
      const currentFile = analysisStore.currentFile;
      if (!currentFile?.path) {
        setToolError('Please upload a file first');
        return;
      }

      // Run crypto analysis using WASM module
      const result = await invokeCommand('execute_wasm_function', {
        moduleName: 'crypto',
        functionName: 'detect_crypto',
        args: [currentFile.path]
      });

      // Update memory dump with crypto artifacts
      setMemoryDump(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          artifacts: {
            ...prev.artifacts,
            // Add any crypto-related findings
          }
        };
      });

      console.log('Crypto analysis result:', result);
    } catch (err) {
      console.error('Crypto analysis failed:', err);
      setToolError(err instanceof Error ? err.message : 'Crypto analysis failed');
    } finally {
      setIsRunningTool(null);
    }
  };

  const extractArtifacts = async () => {
    setIsRunningTool('extract');
    setToolError(null);

    try {
      const dump = memoryDump();
      if (!dump) {
        setToolError('No memory dump loaded');
        return;
      }

      // Export artifacts to file
      const { save } = await import('@tauri-apps/plugin-dialog');
      const savePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'memory_artifacts.json'
      });

      if (savePath) {
        const artifactData = {
          timestamp: new Date().toISOString(),
          artifacts: dump.artifacts,
          strings: dump.strings.slice(0, 100),
          regions: dump.regions.filter(r => r.suspicious),
          processes: dump.processes.filter(p => p.suspicious || p.injected)
        };

        await invokeCommand('write_file_text', {
          path: savePath,
          content: JSON.stringify(artifactData, null, 2)
        });

        setToolError(null);
      }
    } catch (err) {
      console.error('Artifact extraction failed:', err);
      setToolError(err instanceof Error ? err.message : 'Failed to extract artifacts');
    } finally {
      setIsRunningTool(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const filteredProcesses = () => {
    if (!memoryDump()) return [];
    let processes = memoryDump()!.processes;
    
    if (filterSuspicious()) {
      processes = processes.filter(p => p.suspicious || p.injected || p.hidden);
    }
    
    if (searchTerm()) {
      const term = searchTerm().toLowerCase();
      processes = processes.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.path.toLowerCase().includes(term)
      );
    }
    
    return processes;
  };

  const filteredStrings = () => {
    if (!memoryDump()) return [];
    let strings = memoryDump()!.strings;
    
    if (searchTerm()) {
      const term = searchTerm().toLowerCase();
      strings = strings.filter(s => 
        s.value.toLowerCase().includes(term) ||
        s.context.toLowerCase().includes(term)
      );
    }
    
    return strings;
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🧠 Memory Analysis - Deep Forensics
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Memory Dump Analysis" 
            icon="🧠" 
            className="scrollable-panel"
            actions={
              <div>
                <button class="btn btn-secondary" onClick={loadMemoryDump}>📂 Load Dump</button>
                <button class="btn btn-primary" onClick={analyzeMemory}>🔍 Analyze</button>
              </div>
            }
          >
            
            <div class="view-tabs" style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button 
                class={`btn ${activeView() === 'processes' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveView('processes')}
                style="font-size: 0.9rem;"
              >
                🔄 Processes
              </button>
              <button 
                class={`btn ${activeView() === 'strings' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveView('strings')}
                style="font-size: 0.9rem;"
              >
                📝 Strings
              </button>
              <button 
                class={`btn ${activeView() === 'regions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveView('regions')}
                style="font-size: 0.9rem;"
              >
                🗺️ Regions
              </button>
              <button 
                class={`btn ${activeView() === 'artifacts' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveView('artifacts')}
                style="font-size: 0.9rem;"
              >
                🎯 Artifacts
              </button>
            </div>

            <Show when={!memoryDump() && !isAnalyzing()}>
              <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <p>No memory dump loaded</p>
                <button class="btn btn-primary" onClick={analyzeMemory} style="margin-top: 15px;">
                  Start Memory Analysis
                </button>
              </div>
            </Show>

            <Show when={isAnalyzing()}>
              <div style="text-align: center; padding: 20px;">
                <div class="spinner"></div>
                <p style="color: var(--text-secondary); margin-top: 15px;">Analyzing memory dump...</p>
              </div>
            </Show>

            <Show when={memoryDump() && activeView() === 'processes'}>
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">PROCESS MEMORY MAP</strong><br /><br />
                  
                  <For each={filteredProcesses()}>
                    {(process) => (
                      <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255, 107, 157, 0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                          <strong style="color: var(--warning-color)">
                            {process.suspicious ? '⚠️' : '📋'} {process.name} (PID: {process.pid})
                          </strong>
                          <span style="color: var(--text-secondary)">Memory: {formatBytes(process.workingSet)}</span>
                        </div>
                        
                        <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 10px;">
                          {process.path}
                        </div>
                        
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                          <Show when={process.injected}>
                            <span style="background: var(--danger-color); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Injected</span>
                          </Show>
                          <Show when={process.hidden}>
                            <span style="background: var(--warning-color); color: black; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Hidden</span>
                          </Show>
                          <Show when={process.suspicious}>
                            <span style="background: var(--barbie-pink); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Suspicious</span>
                          </Show>
                        </div>
                        
                        <div style="margin-top: 10px; font-size: 0.85rem;">
                          <span style="color: var(--info-color)">Threads: {process.threads}</span> | 
                          <span style="color: var(--info-color)">Handles: {process.handles}</span> | 
                          <span style="color: var(--info-color)">Virtual: {formatBytes(process.virtualSize)}</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={memoryDump() && activeView() === 'strings'}>
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">EXTRACTED STRINGS</strong><br /><br />
                  
                  <For each={filteredStrings()}>
                    {(str) => (
                      <div style="margin-bottom: 15px;">
                        <span style="color: var(--info-color)">0x{str.offset.toString(16).padStart(8, '0')}</span> 
                        <span style="color: var(--text-secondary)">({str.encoding})</span> - 
                        <span style="color: var(--success-color)">{str.context}</span><br />
                        <span style="color: var(--warning-color)">→ {str.value}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={memoryDump() && activeView() === 'regions'}>
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">MEMORY REGIONS</strong><br /><br />
                  
                  <div style="display: grid; grid-template-columns: auto auto auto auto auto; gap: 10px; font-size: 0.85rem;">
                    <strong style="color: var(--info-color)">Address</strong>
                    <strong style="color: var(--info-color)">Size</strong>
                    <strong style="color: var(--info-color)">Protection</strong>
                    <strong style="color: var(--info-color)">Type</strong>
                    <strong style="color: var(--info-color)">Entropy</strong>
                    
                    <For each={memoryDump()!.regions}>
                      {(region) => (
                        <>
                          <span style="color: var(--text-secondary); font-family: monospace;">{region.address}</span>
                          <span style="color: var(--text-secondary);">{formatBytes(region.size)}</span>
                          <span style={{color: region.protection === 'RWX' ? 'var(--danger-color)' : 'var(--success-color)'}}>
                            {region.protection}
                          </span>
                          <span style="color: var(--text-secondary);">{region.type}</span>
                          <span style={{color: region.entropy > 7 ? 'var(--warning-color)' : 'var(--text-secondary)'}}>
                            {region.entropy.toFixed(2)}
                          </span>
                        </>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={memoryDump() && activeView() === 'artifacts'}>
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">EXTRACTED ARTIFACTS</strong><br /><br />
                  
                  <strong style="color: var(--warning-color)">🌐 Network Indicators:</strong><br />
                  <For each={memoryDump()!.artifacts.urls}>
                    {(url) => <><span style="color: var(--danger-color)">URL:</span> {url}<br /></>}
                  </For>
                  <For each={memoryDump()!.artifacts.ips}>
                    {(ip) => <><span style="color: var(--danger-color)">IP:</span> {ip}<br /></>}
                  </For>
                  <br />
                  
                  <strong style="color: var(--warning-color)">🔐 System Artifacts:</strong><br />
                  <For each={memoryDump()!.artifacts.mutexes}>
                    {(mutex) => <><span style="color: var(--info-color)">Mutex:</span> {mutex}<br /></>}
                  </For>
                  <For each={memoryDump()!.artifacts.registryKeys}>
                    {(key) => <><span style="color: var(--info-color)">Registry:</span> {key}<br /></>}
                  </For>
                  <br />
                  
                  <strong style="color: var(--warning-color)">📁 File System:</strong><br />
                  <For each={memoryDump()!.artifacts.files}>
                    {(file) => <><span style="color: var(--success-color)">File:</span> {file}<br /></>}
                  </For>
                </div>
              </div>
            </Show>
          </AnalysisPanel>

          <AnalysisPanel title="String Analysis" icon="📝" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content">
                <strong style="color: var(--barbie-pink)">EXTRACTED STRINGS</strong><br /><br />

                <Show when={memoryDump() && (memoryDump()!.artifacts.urls.length > 0 || memoryDump()!.strings.length > 0)} fallback={
                  <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                    <p>No strings extracted yet.</p>
                    <p style="font-size: 0.85rem;">Load a memory dump or analyze a file to extract strings.</p>
                  </div>
                }>
                  <Show when={memoryDump()!.artifacts.urls.length > 0}>
                    <strong style="color: var(--danger-color)">🌐 Network Indicators:</strong><br />
                    <For each={memoryDump()!.artifacts.urls.slice(0, 10)}>
                      {(url) => <><span style="color: var(--warning-color)">• {url}</span><br /></>}
                    </For>
                    <br />
                  </Show>

                  <Show when={memoryDump()!.artifacts.ips.length > 0}>
                    <strong style="color: var(--danger-color)">🖥️ IP Addresses:</strong><br />
                    <For each={memoryDump()!.artifacts.ips.slice(0, 10)}>
                      {(ip) => <><span style="color: var(--info-color)">• {ip}</span><br /></>}
                    </For>
                    <br />
                  </Show>

                  <Show when={memoryDump()!.artifacts.files.length > 0}>
                    <strong style="color: var(--danger-color)">📂 File Paths:</strong><br />
                    <For each={memoryDump()!.artifacts.files.slice(0, 10)}>
                      {(file) => <><span style="color: var(--success-color)">• {file}</span><br /></>}
                    </For>
                    <br />
                  </Show>

                  <Show when={memoryDump()!.artifacts.registryKeys.length > 0}>
                    <strong style="color: var(--danger-color)">🔑 Registry Keys:</strong><br />
                    <For each={memoryDump()!.artifacts.registryKeys.slice(0, 10)}>
                      {(key) => <><span style="color: var(--text-secondary)">• {key}</span><br /></>}
                    </For>
                    <br />
                  </Show>

                  <Show when={memoryDump()!.strings.length > 0}>
                    <strong style="color: var(--danger-color)">📝 Suspicious Strings ({memoryDump()!.strings.length}):</strong><br />
                    <For each={memoryDump()!.strings.filter(s => s.context === 'suspicious').slice(0, 20)}>
                      {(str) => <><span style="color: var(--warning-color)">• {str.value.substring(0, 100)}{str.value.length > 100 ? '...' : ''}</span><br /></>}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 System Statistics
          </h3>
          
          <div class="stats-overview">
            <StatCard 
              label="Total Memory"
              value={memoryInfo() ? `${(memoryInfo().total / 1024 / 1024 / 1024).toFixed(1)} GB` : '0 GB'}
            />
            <StatCard 
              label="Used Memory"
              value={memoryInfo() ? `${(memoryInfo().used / 1024 / 1024 / 1024).toFixed(1)} GB` : '0 GB'}
            />
            <StatCard 
              label="CPU Usage"
              value={cpuInfo() ? `${cpuInfo().usage.toFixed(1)}%` : '0%'}
            />
            <StatCard 
              label="System Uptime"
              value={systemInfo() ? formatUptime(systemInfo().uptime) : '0s'}
            />
          </div>
          
          <Show when={memoryDump()}>
            <h3 style="color: var(--barbie-pink); margin: 15px 0;">
              🧠 Analysis Statistics
            </h3>
            
            <div class="stats-overview">
              <StatCard 
                label="Processes"
                value={memoryDump()!.processes.length.toString()}
              />
              <StatCard 
                label="Injected"
                value={memoryDump()!.processes.filter(p => p.injected).length.toString()}
              />
              <StatCard 
                label="Suspicious"
                value={memoryDump()!.processes.filter(p => p.suspicious).length.toString()}
              />
              <StatCard 
                label="Artifacts"
                value={(memoryDump()!.artifacts.urls.length + memoryDump()!.artifacts.files.length).toString()}
              />
            </div>
          </Show>
          
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🛠️ Memory Tools
          </h3>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button
              class="btn btn-primary"
              onClick={runVolatilityAnalysis}
              disabled={isRunningTool() !== null}
            >
              {isRunningTool() === 'volatility' ? '⏳ Analyzing...' : '🔬 Volatility Analysis'}
            </button>
            <button
              class="btn btn-secondary"
              onClick={showProcessTree}
              disabled={isRunningTool() !== null}
            >
              {isRunningTool() === 'process-tree' ? '⏳ Loading...' : '🌳 Process Tree'}
            </button>
            <button
              class="btn btn-secondary"
              onClick={analyzeNetworkConnections}
              disabled={isRunningTool() !== null}
            >
              {isRunningTool() === 'network' ? '⏳ Analyzing...' : '🌐 Network Connections'}
            </button>
            <button
              class="btn btn-secondary"
              onClick={runCryptoAnalysis}
              disabled={isRunningTool() !== null}
            >
              {isRunningTool() === 'crypto' ? '⏳ Scanning...' : '🔐 Crypto Analysis'}
            </button>
            <button
              class="btn btn-secondary"
              onClick={extractArtifacts}
              disabled={isRunningTool() !== null || !memoryDump()}
            >
              {isRunningTool() === 'extract' ? '⏳ Extracting...' : '📤 Extract Artifacts'}
            </button>
          </div>

          {/* Tool Error Display */}
          <Show when={toolError()}>
            <div style="margin-top: 15px; padding: 10px; background: rgba(255, 107, 107, 0.1); border: 1px solid var(--danger-color); border-radius: 6px;">
              <span style="color: var(--danger-color);">⚠️ {toolError()}</span>
            </div>
          </Show>

          {/* Tool Results Display */}
          <Show when={activeToolView() === 'volatility' && volatilityResult()}>
            <div style="margin-top: 15px;">
              <h4 style="color: var(--info-color); margin-bottom: 10px;">Volatility Results</h4>
              <div style="background: var(--code-bg); padding: 10px; border-radius: 6px; font-size: 0.85rem;">
                <Show when={volatilityResult()!.processes?.length}>
                  <p><strong>Processes:</strong> {volatilityResult()!.processes?.length}</p>
                </Show>
                <Show when={volatilityResult()!.network_connections?.length}>
                  <p><strong>Network:</strong> {volatilityResult()!.network_connections?.length} connections</p>
                </Show>
                <Show when={volatilityResult()!.injected_code?.length}>
                  <p style="color: var(--danger-color);"><strong>⚠️ Injected Code:</strong> {volatilityResult()!.injected_code?.length} detections</p>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={activeToolView() === 'process-tree' && processTree().length > 0}>
            <div style="margin-top: 15px;">
              <h4 style="color: var(--info-color); margin-bottom: 10px;">Process Tree</h4>
              <div style="background: var(--code-bg); padding: 10px; border-radius: 6px; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">
                <For each={processTree().slice(0, 15)}>
                  {(proc) => (
                    <div style={`padding-left: ${proc.depth * 15}px; margin-bottom: 4px;`}>
                      <span style="color: var(--success-color);">{proc.depth > 0 ? '└─ ' : ''}</span>
                      <span style="color: var(--text-primary);">{proc.name}</span>
                      <span style="color: var(--text-secondary);"> (PID: {proc.pid})</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={activeToolView() === 'network' && networkConnections().length > 0}>
            <div style="margin-top: 15px;">
              <h4 style="color: var(--info-color); margin-bottom: 10px;">Network Connections</h4>
              <div style="background: var(--code-bg); padding: 10px; border-radius: 6px; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">
                <For each={networkConnections().slice(0, 10)}>
                  {(conn) => (
                    <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                      <div style="color: var(--warning-color);">
                        {conn.destination}:{conn.port}
                      </div>
                      <div style="color: var(--text-secondary); font-size: 0.8rem;">
                        {conn.protocol} | {conn.connection_count} connection(s)
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default MemoryAnalysis;