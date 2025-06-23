import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { analysisStore } from '../../../stores/analysisStore';
import type { ThreatIntelligence as ThreatIntelType, ThreatIndicator } from '../../../types/analysis';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './ThreatIntelligence.css';

const ThreatIntelligence: Component = () => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [threatIntel, setThreatIntel] = createSignal<ThreatIntelType[]>([]);
  const [selectedSource, setSelectedSource] = createSignal<string>('all');
  const [error, setError] = createSignal<string | null>(null);

  const sources = [
    { id: 'all', name: 'All Sources', icon: '🌐' },
    { id: 'virustotal', name: 'VirusTotal', icon: '🛡️' },
    { id: 'alienvault', name: 'AlienVault OTX', icon: '👽' },
    { id: 'misp', name: 'MISP', icon: '🔗' },
    { id: 'threatfox', name: 'ThreatFox', icon: '🦊' },
    { id: 'malwarebazaar', name: 'MalwareBazaar', icon: '🏪' }
  ];

  onMount(() => {
    // Auto-fetch if we have a file
    if (analysisStore.currentFile) {
      fetchThreatIntelligence();
    }
  });

  const fetchThreatIntelligence = async () => {
    const file = analysisStore.currentFile;
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<ThreatIntelType[]>('get_threat_intelligence', {
        fileHash: file.hash,
        iocs: [] // Will be populated from other analysis
      });
      
      setThreatIntel(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch threat intelligence');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIntel = () => {
    if (selectedSource() === 'all') return threatIntel();
    return threatIntel().filter(intel => intel.source.toLowerCase() === selectedSource());
  };

  const getThreatLevelColor = (indicators: ThreatIndicator[]) => {
    const maxConfidence = Math.max(...indicators.map(i => i.confidence));
    if (maxConfidence > 0.8) return '#f38ba8';
    if (maxConfidence > 0.6) return '#fab387';
    if (maxConfidence > 0.4) return '#f9e2af';
    return '#a6e3a1';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Mock IOCs data for template compliance
  const mockIOCs = {
    fileHashes: {
      md5: 'a1b2c3d4e5f6789012345678901234567',
      sha1: '9876543210abcdef9876543210abcdef98765432',
      sha256: '1234567890abcdef1234567890abcdef1234567890abcdef'
    },
    networkIndicators: [
      { type: 'Domain', value: 'malicious-c2.example.com' },
      { type: 'Domain', value: 'update-server.badsite.org' },
      { type: 'IP', value: '192.168.1.100:8080' },
      { type: 'IP', value: '203.0.113.42:80' },
      { type: 'URL', value: 'hxxp://malicious-c2.example.com/beacon.php' },
      { type: 'URL', value: 'hxxp://data-exfil.evil.net/upload' }
    ],
    fileSystem: [
      'C:\\Windows\\Temp\\update.exe',
      '%APPDATA%\\svchost.exe',
      'C:\\Users\\Public\\config.dat'
    ],
    registry: [
      { key: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\Update', value: '"C:\\Windows\\Temp\\update.exe"' }
    ],
    processes: [
      { name: 'svchost.exe', type: 'fake service host' },
      { name: 'rundll32.exe', type: 'malicious DLL loading' },
      { name: 'explorer.exe', type: 'process hollowing' }
    ]
  };

  const mitreMapping = [
    { category: 'Initial Access', techniques: ['T1566.001 - Spearphishing Attachment', 'T1566.002 - Spearphishing Link'] },
    { category: 'Execution', techniques: ['T1059.003 - Windows Command Shell', 'T1204.002 - Malicious File'] },
    { category: 'Persistence', techniques: ['T1547.001 - Registry Run Keys', 'T1053.005 - Scheduled Task'] },
    { category: 'Defense Evasion', techniques: ['T1055.012 - Process Hollowing', 'T1027 - Obfuscated Files', 'T1140 - Deobfuscate/Decode Files'] },
    { category: 'Collection', techniques: ['T1056.001 - Keylogging', 'T1113 - Screen Capture'] },
    { category: 'Command and Control', techniques: ['T1071.001 - Web Protocols', 'T1573.001 - Symmetric Cryptography'] }
  ];

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🚨 Threat Intelligence - IOCs & Attribution
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Indicators of Compromise (IOCs)" 
            icon="🎯"
            actions={
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary">📋 Copy IOCs</button>
                <button class="btn btn-primary">📤 Export STIX</button>
              </div>
            }
            className="scrollable-panel"
          >
            <div class="code-editor">
              <div class="code-content">
                <strong style="color: var(--danger-color);">🚨 HIGH PRIORITY IOCs</strong><br /><br />
                
                <strong style="color: var(--barbie-pink);">File Hashes:</strong><br />
                <span style="color: var(--danger-color);">MD5:</span> {mockIOCs.fileHashes.md5}<br />
                <span style="color: var(--danger-color);">SHA1:</span> {mockIOCs.fileHashes.sha1}<br />
                <span style="color: var(--danger-color);">SHA256:</span> {mockIOCs.fileHashes.sha256}<br /><br />
                
                <strong style="color: var(--barbie-pink);">Network Indicators:</strong><br />
                <For each={mockIOCs.networkIndicators}>
                  {(indicator) => (
                    <div>
                      <span style="color: var(--danger-color);">{indicator.type}:</span> {indicator.value}<br />
                    </div>
                  )}
                </For>
                <br />
                
                <strong style="color: var(--barbie-pink);">File System Artifacts:</strong><br />
                <For each={mockIOCs.fileSystem}>
                  {(file) => (
                    <div>
                      <span style="color: var(--warning-color);">File:</span> {file}<br />
                    </div>
                  )}
                </For>
                <br />
                
                <strong style="color: var(--barbie-pink);">Registry Keys:</strong><br />
                <For each={mockIOCs.registry}>
                  {(reg) => (
                    <div>
                      <span style="color: var(--danger-color);">Key:</span> {reg.key}<br />
                      <span style="color: var(--warning-color);">Value:</span> {reg.value}<br />
                    </div>
                  )}
                </For>
                <br />
                
                <strong style="color: var(--barbie-pink);">Process Indicators:</strong><br />
                <For each={mockIOCs.processes}>
                  {(proc) => (
                    <div>
                      <span style="color: var(--warning-color);">Process:</span> {proc.name} ({proc.type})<br />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </AnalysisPanel>
          
          <AnalysisPanel title="Attribution & Campaign Analysis" icon="🕵️" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content">
                <strong style="color: var(--barbie-pink);">THREAT ATTRIBUTION</strong><br /><br />
                
                <strong>Campaign Name:</strong> <span style="color: var(--danger-color);">Operation Banking Wolf</span><br />
                <strong>Threat Actor:</strong> <span style="color: var(--warning-color);">TA505 (Financially Motivated)</span><br />
                <strong>Active Since:</strong> <span style="color: var(--text-secondary);">September 2024</span><br />
                <strong>Geographic Focus:</strong> <span style="color: var(--info-color);">North America, Europe</span><br />
                <strong>Confidence Level:</strong> <span style="color: var(--success-color);">High (85%)</span><br /><br />
                
                <strong style="color: var(--barbie-pink);">CAMPAIGN CHARACTERISTICS:</strong><br /><br />
                
                <strong>Primary Targets:</strong><br />
                • Financial institutions and their customers<br />
                • E-commerce platforms<br />
                • Online banking users<br />
                • Small to medium businesses<br /><br />
                
                <strong>Attack Vector:</strong><br />
                • Phishing emails with malicious attachments<br />
                • Fake software updates<br />
                • Exploit kits on compromised websites<br />
                • Social engineering campaigns<br /><br />
                
                <strong>Infrastructure Pattern:</strong><br />
                • Uses fast-flux DNS for C2 servers<br />
                • Bulletproof hosting in Eastern Europe<br />
                • Domain generation algorithm (DGA) backup<br />
                • Encrypted communication channels<br /><br />
                
                <strong style="color: var(--barbie-pink);">RELATED SAMPLES:</strong><br />
                • SHA256: abcdef1234567890... (87% similarity)<br />
                • SHA256: fedcba0987654321... (92% similarity)<br />
                • SHA256: 1357924680acebd... (76% similarity)
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <div class="mitre-mapping-section">
            <h3 class="mitre-mapping-header">
              🎯 MITRE ATT&CK Mapping
            </h3>
            
            <div class="mitre-categories">
              <For each={mitreMapping}>
                {(category) => (
                  <div class="mitre-category">
                    <strong class="mitre-category-name">{category.category}:</strong>
                    <For each={category.techniques}>
                      {(technique) => {
                        const [id, ...desc] = technique.split(' - ');
                        return (
                          <div class="mitre-technique">
                            <span class="mitre-technique-id">{id}</span> - {desc.join(' - ')}
                          </div>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
          
          <div class="defense-section">
            <h3 class="defense-header">
              🛡️ Defense Recommendations
            </h3>
            
            <div class="defense-content">
              <div class="defense-priority">
                <strong class="priority-label immediate">Immediate Actions:</strong>
                <div class="defense-item">✅ Block malicious domains/IPs</div>
                <div class="defense-item">✅ Remove registry persistence</div>
                <div class="defense-item">✅ Scan for similar indicators</div>
                <div class="defense-item">✅ Update endpoint protection</div>
              </div>
              
              <div class="defense-priority">
                <strong class="priority-label medium">Medium-term:</strong>
                <div class="defense-item">⚠️ User awareness training</div>
                <div class="defense-item">⚠️ Email security hardening</div>
                <div class="defense-item">⚠️ Network segmentation</div>
                <div class="defense-item">⚠️ Behavioral monitoring</div>
              </div>
            </div>
          </div>
          
          <div class="threat-actions">
            <button class="threat-action-btn primary">📤 Share Intel</button>
            <button class="threat-action-btn">🔗 MITRE Navigator</button>
            <button class="threat-action-btn">📊 Campaign Report</button>
            <button class="threat-action-btn">🚨 Create Alert</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatIntelligence;