import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
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

const MemoryAnalysis: Component = () => {
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [memoryDump, setMemoryDump] = createSignal<MemoryDump | null>(null);
  const [activeView, setActiveView] = createSignal<'processes' | 'strings' | 'regions' | 'artifacts'>('processes');
  const [filterSuspicious] = createSignal(false);
  const [searchTerm] = createSignal('');

  onMount(() => {
    // Mock data for demonstration
    if (analysisStore.currentFile) {
      generateMockMemoryDump();
    }
  });

  const generateMockMemoryDump = () => {
    setMemoryDump({
      timestamp: Date.now() / 1000,
      processes: [
        {
          pid: 1234,
          name: 'malware.exe',
          path: 'C:\\Windows\\Temp\\malware.exe',
          parentPid: 567,
          threads: 8,
          handles: 145,
          virtualSize: 2097152,
          workingSet: 1048576,
          injected: true,
          hidden: false,
          suspicious: true
        },
        {
          pid: 567,
          name: 'explorer.exe',
          path: 'C:\\Windows\\explorer.exe',
          parentPid: 1,
          threads: 42,
          handles: 1287,
          virtualSize: 134217728,
          workingSet: 67108864,
          injected: true,
          hidden: false,
          suspicious: true
        },
        {
          pid: 2345,
          name: 'svchost.exe',
          path: 'C:\\Windows\\System32\\svchost.exe',
          parentPid: 456,
          threads: 12,
          handles: 234,
          virtualSize: 16777216,
          workingSet: 8388608,
          injected: false,
          hidden: false,
          suspicious: false
        }
      ],
      strings: [
        {
          offset: 0x00401000,
          value: 'http://malicious-c2.com/beacon',
          encoding: 'ASCII',
          context: 'Network communication'
        },
        {
          offset: 0x00402340,
          value: 'SELECT * FROM credit_cards',
          encoding: 'UTF-16',
          context: 'Database query'
        },
        {
          offset: 0x00403890,
          value: 'cmd.exe /c powershell -enc',
          encoding: 'ASCII',
          context: 'Command execution'
        }
      ],
      regions: [
        {
          address: '0x00400000',
          size: 65536,
          protection: 'RWX',
          type: 'Private',
          suspicious: true,
          entropy: 7.85
        },
        {
          address: '0x7FFE0000',
          size: 4096,
          protection: 'R--',
          type: 'Image',
          suspicious: false,
          entropy: 3.24
        }
      ],
      artifacts: {
        urls: [
          'http://malicious-c2.com/beacon',
          'https://evil-payload.net/download',
          'ftp://anonymous@badserver.com'
        ],
        ips: [
          '192.168.1.100',
          '10.0.0.50',
          '172.16.0.100'
        ],
        mutexes: [
          'Global\\MalwareMutex123',
          'Local\\SystemUpdate_2024'
        ],
        registryKeys: [
          'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Update',
          'HKCU\\Software\\Classes\\malware'
        ],
        files: [
          'C:\\Windows\\Temp\\payload.exe',
          'C:\\Users\\Public\\malware.dll',
          'C:\\ProgramData\\update.bat'
        ]
      }
    });
  };

  const analyzeMemory = async () => {
    setIsAnalyzing(true);
    
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000));
    generateMockMemoryDump();
    
    setIsAnalyzing(false);
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
                <button class="btn btn-secondary" onClick={() => generateMockMemoryDump()}>📂 Load Dump</button>
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
                <strong style="color: var(--barbie-pink)">SUSPICIOUS STRINGS FOUND</strong><br /><br />
                
                <strong style="color: var(--danger-color)">🌐 Network Indicators:</strong><br />
                <span style="color: var(--warning-color)">• http://malicious-c2.com/beacon</span><br />
                <span style="color: var(--warning-color)">• https://evil-payload.net/download</span><br />
                <span style="color: var(--warning-color)">• ftp://anonymous@badserver.com</span><br /><br />
                
                <strong style="color: var(--danger-color)">🔑 Encryption Keys:</strong><br />
                <span style="color: var(--info-color)">• AES Key: 4d794b657948657265</span><br />
                <span style="color: var(--info-color)">• RC4 Key: 53656372657450617373</span><br /><br />
                
                <strong style="color: var(--danger-color)">📂 File Paths:</strong><br />
                <span style="color: var(--success-color)">• C:\\Windows\\Temp\\payload.exe</span><br />
                <span style="color: var(--success-color)">• C:\\Users\\Public\\malware.dll</span><br />
                <span style="color: var(--success-color)">• %APPDATA%\\svchost.exe</span><br /><br />
                
                <strong style="color: var(--danger-color)">⚡ Commands:</strong><br />
                <span style="color: var(--text-secondary)">• cmd.exe /c powershell -enc</span><br />
                <span style="color: var(--text-secondary)">• rundll32.exe shell32.dll</span><br />
                <span style="color: var(--text-secondary)">• reg add HKLM\\Software\\</span>
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 Memory Statistics
          </h3>
          
          <div class="stats-overview">
            <StatCard 
              label="Total Memory"
              value="8.2 GB"
            />
            <StatCard 
              label="Processes"
              value={memoryDump() ? memoryDump()!.processes.length.toString() : '0'}
            />
            <StatCard 
              label="Injected Modules"
              value={memoryDump() ? memoryDump()!.processes.filter(p => p.injected).length.toString() : '0'}
            />
            <StatCard 
              label="Rootkit Hooks"
              value="17"
            />
          </div>
          
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🛠️ Memory Tools
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary">🔬 Volatility Analysis</button>
            <button class="btn btn-secondary">🌳 Process Tree</button>
            <button class="btn btn-secondary">🌐 Network Connections</button>
            <button class="btn btn-secondary">🔐 Crypto Analysis</button>
            <button class="btn btn-secondary">📤 Extract Artifacts</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryAnalysis;