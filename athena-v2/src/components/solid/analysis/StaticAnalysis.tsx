import { Component, createSignal } from 'solid-js';
import { StatCard } from '../shared/StatCard';
import AnalysisPanel from '../shared/AnalysisPanel';
import CodeEditor from '../shared/CodeEditor';
import './StaticAnalysis.css';

const StaticAnalysis: Component = () => {
  const [fileHashes] = createSignal({
    md5: 'a1b2c3d4e5f6789012345678901234567',
    sha1: '9876543210abcdef9876543210abcdef98765432',
    sha256: '1234567890abcdef1234567890abcdef1234567890abcdef',
    ssdeep: '98304:abc123def456ghi789...'
  });

  const [fileInfo] = createSignal({
    architecture: 'x86-64',
    entryPoint: '0x401000',
    sections: 5,
    imports: 47,
    exports: 12,
    resources: 3,
    timestamp: '2024-12-15 14:30:22 UTC'
  });

  const [strings] = createSignal([
    'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
    'C:\\Windows\\System32\\rundll32.exe',
    '192.168.1.100:8080',
    'keylogger.dll',
    'encrypt_files'
  ]);

  const [apiCalls] = createSignal([
    { name: 'RegCreateKeyEx', description: 'Registry manipulation' },
    { name: 'CreateFile', description: 'File system access' },
    { name: 'InternetConnect', description: 'Network activity' },
    { name: 'SetWindowsHookEx', description: 'Hooking mechanism' }
  ]);

  const [aiResults] = createSignal([
    { provider: '🤖 Claude 3.5 Sonnet', prediction: 'Identified vulnerable entry points and evasion techniques. Confidence: 92%' },
    { provider: '🧠 GPT-4 Turbo', prediction: 'Architecture suggests multi-stage payload delivery. Risk level: High' },
    { provider: '🔍 DeepSeek V3', prediction: 'Matches known campaign signatures. Attribution: Possible APT group' },
    { provider: '💎 Claude 3 Opus', prediction: 'Code patterns indicate commercial packer with obfuscation' },
    { provider: '⚡ GPT-4o', prediction: 'Infrastructure impact: Network monitoring, persistence mechanisms' },
    { provider: '🌟 Gemini Pro', prediction: 'Family: TrojanDownloader.Win32.Emotet. Variant: 2024.Q4' }
  ]);

  const hashContent = `MD5: ${fileHashes().md5}
SHA1: ${fileHashes().sha1}
SHA256: ${fileHashes().sha256}
SSDEEP: ${fileHashes().ssdeep}

File Info:
Architecture: ${fileInfo().architecture}
Entry Point: ${fileInfo().entryPoint}
Sections: ${fileInfo().sections}
Imports: ${fileInfo().imports}
Exports: ${fileInfo().exports}
Resources: ${fileInfo().resources}
Timestamp: ${fileInfo().timestamp}`;

  const stringsContent = `Suspicious Strings:
${strings().join('\n')}

API Calls:
${apiCalls().map(api => `${api.name} - ${api.description}`).join('\n')}`;

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🔍 Static Analysis Results
      </h2>
      
      <div class="stats-overview" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
        <StatCard 
          value="PE32" 
          label="File Type" 
        />
        <StatCard 
          value="2.3MB" 
          label="File Size" 
        />
        <div class="entropy-stat-card">
          <StatCard 
            value="7.82" 
            label="Entropy Score" 
          />
          <div class="entropy-bar">
            <div class="entropy-fill" style="width: 78.2%"></div>
            <span class="entropy-label">78.2%</span>
          </div>
        </div>
        <StatCard 
          value="UPX" 
          label="Packer Detected" 
        />
      </div>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel title="File Hashes & Properties" icon="🔐">
            <div class="hash-display">
              <div class="hash-item">
                <span class="hash-label">MD5:</span>
                <span class="hash-value">{fileHashes().md5}</span>
              </div>
              <div class="hash-item">
                <span class="hash-label">SHA1:</span>
                <span class="hash-value">{fileHashes().sha1}</span>
              </div>
              <div class="hash-item">
                <span class="hash-label">SHA256:</span>
                <span class="hash-value">{fileHashes().sha256}</span>
              </div>
              <div class="hash-item">
                <span class="hash-label">SSDEEP:</span>
                <span class="hash-value">{fileHashes().ssdeep}</span>
              </div>
            </div>
            
            <div class="file-properties">
              <div class="property-item">
                <span class="property-label">Architecture:</span>
                <span class="property-value">{fileInfo().architecture}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Entry Point:</span>
                <span class="property-value">{fileInfo().entryPoint}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Sections:</span>
                <span class="property-value">{fileInfo().sections}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Imports:</span>
                <span class="property-value">{fileInfo().imports}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Exports:</span>
                <span class="property-value">{fileInfo().exports}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Resources:</span>
                <span class="property-value">{fileInfo().resources}</span>
              </div>
            </div>
          </AnalysisPanel>
          
          <AnalysisPanel title="Strings & Indicators" icon="🧬">
            <div>
              <h4 style="color: var(--barbie-pink); margin-bottom: 10px;">Suspicious Strings:</h4>
              <div class="strings-list">
                {strings().map(str => (
                  <div class="string-item">{str}</div>
                ))}
              </div>
              
              <h4 style="color: var(--barbie-pink); margin: 20px 0 10px;">API Calls:</h4>
              <div class="api-list">
                {apiCalls().map(api => (
                  <div class="api-item">
                    <span class="api-name">{api.name}</span>
                    <span class="api-description">{api.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🤖 AI Provider Ensemble Analysis
          </h3>
          
          <div class="ensemble-consensus">
            <div class="consensus-score">94% Confidence</div>
            <div style="color: var(--text-secondary);">
              <strong>Consensus:</strong> High-risk malware - Trojan/Info-stealer
            </div>
          </div>
          
          <div class="agent-results">
            {aiResults().map(result => (
              <div class="agent-result">
                <div class="agent-name">{result.provider}</div>
                <div class="agent-prediction">{result.prediction}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaticAnalysis;