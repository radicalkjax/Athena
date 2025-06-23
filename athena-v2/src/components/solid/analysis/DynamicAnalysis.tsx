import { Component, createSignal, For } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import './DynamicAnalysis.css';

interface BehaviorEvent {
  type: 'success' | 'warning' | 'danger';
  symbol: string;
  description: string;
}

interface ATTACKMapping {
  id: string;
  name: string;
  description: string;
}

const DynamicAnalysis: Component = () => {
  const [behaviorEvents] = createSignal<BehaviorEvent[]>([
    { type: 'success', symbol: '[+]', description: 'Process created: malware_sample.exe (PID: 1234)' },
    { type: 'warning', symbol: '[!]', description: 'Registry key created: HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\Update' },
    { type: 'warning', symbol: '[!]', description: 'File created: C:\\Windows\\Temp\\update.exe' },
    { type: 'danger', symbol: '[!]', description: 'Network connection: 192.168.1.100:8080 (TCP)' },
    { type: 'warning', symbol: '[!]', description: 'HTTP POST request to: hxxp://malicious-c2.example.com/beacon' },
    { type: 'danger', symbol: '[!]', description: 'Process injection detected: explorer.exe' },
    { type: 'warning', symbol: '[!]', description: 'Keylogger activity: SetWindowsHookEx' },
    { type: 'success', symbol: '[+]', description: 'Process terminated after 120 seconds' }
  ]);

  const [networkActivity] = createSignal({
    dnsQueries: [
      'malicious-c2.example.com → 192.168.1.100',
      'update-server.badsite.org → 203.0.113.42'
    ],
    connections: [
      'TCP 192.168.1.100:8080 - Command & Control',
      'HTTP 203.0.113.42:80 - Data exfiltration'
    ],
    dataTransfer: {
      outbound: '2.3 KB (encrypted)',
      inbound: '847 bytes (commands)'
    }
  });

  const [mitreAttacks] = createSignal<ATTACKMapping[]>([
    { id: 'T1055', name: 'Process Injection', description: 'Detected injection into explorer.exe process' },
    { id: 'T1060', name: 'Registry Run Keys', description: 'Persistence via Run key modification' },
    { id: 'T1071', name: 'Application Layer Protocol', description: 'HTTP-based C2 communication' },
    { id: 'T1056', name: 'Input Capture', description: 'Keylogging functionality detected' }
  ]);

  const [recommendations] = createSignal([
    'Block outbound connections to 192.168.1.100',
    'Remove registry persistence mechanism',
    'Monitor for similar process injection patterns',
    'Update endpoint detection rules'
  ]);

  const getColorForEventType = (type: string): string => {
    switch(type) {
      case 'success': return 'var(--success-color)';
      case 'warning': return 'var(--warning-color)';
      case 'danger': return 'var(--danger-color)';
      default: return 'var(--text-primary)';
    }
  };

  const behaviorContent = behaviorEvents().map(event => 
    `<div class="console-line ${event.type}">${event.symbol} ${event.description}</div>`
  ).join('\n');

  const networkContent = `<strong>DNS Queries:</strong>
${networkActivity().dnsQueries.join('\n')}

<strong>Network Connections:</strong>
${networkActivity().connections.join('\n')}

<strong>Data Transmitted:</strong>
Outbound: ${networkActivity().dataTransfer.outbound}
Inbound: ${networkActivity().dataTransfer.inbound}`;

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        ⚡ Dynamic Analysis - CAPE Sandbox
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Behavioral Analysis" 
            icon="🎬"
            actions={<button class="btn btn-secondary">📸 View Screenshots</button>}
            className="scrollable-panel"
          >
            <div class="behavioral-console" innerHTML={behaviorContent}></div>
          </AnalysisPanel>
          
          <AnalysisPanel title="Network Activity" icon="🌐" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content" innerHTML={networkContent}></div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🎯 MITRE ATT&CK Mapping
          </h3>
          
          <div class="mitre-attack-cards">
            <For each={mitreAttacks()}>
              {(attack) => (
                <div class="attack-card">
                  <div class="attack-header">
                    <span class="attack-id">{attack.id}</span>
                    <span class="attack-name">{attack.name}</span>
                  </div>
                  <div class="attack-description">{attack.description}</div>
                </div>
              )}
            </For>
          </div>
          
          <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
            🛡️ Recommendations
          </h3>
          
          <div class="ensemble-consensus">
            <div style="color: var(--text-primary);">
              <For each={recommendations()}>
                {(rec) => <div>• {rec}</div>}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicAnalysis;