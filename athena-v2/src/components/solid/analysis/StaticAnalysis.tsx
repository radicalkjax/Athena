import { Component, createSignal, createEffect, onMount, Show } from 'solid-js';
import { StatCard } from '../shared/StatCard';
import AnalysisPanel from '../shared/AnalysisPanel';
import { analysisStore } from '../../../stores/analysisStore';
import './StaticAnalysis.css';

const StaticAnalysis: Component = () => {
  const [fileHashes, setFileHashes] = createSignal({
    md5: '',
    sha1: '',
    sha256: '',
    ssdeep: ''
  });

  const [fileInfo, setFileInfo] = createSignal({
    architecture: '',
    entryPoint: '',
    sections: 0,
    imports: 0,
    exports: 0,
    resources: 0,
    timestamp: ''
  });

  const [strings, setStrings] = createSignal<string[]>([]);
  const [apiCalls, setApiCalls] = createSignal<Array<{name: string, description: string}>>([]);
  const [aiResults, setAiResults] = createSignal<Array<{provider: string, prediction: string, confidence?: number}>>([]);

  // Compute consensus from AI results
  const getConsensus = () => {
    const results = aiResults();
    if (results.length === 0) {
      return { confidence: 0, verdict: 'Awaiting analysis' };
    }

    // Calculate average confidence from providers
    const confidences = results
      .map(r => r.confidence ?? 50)
      .filter(c => c > 0);
    const avgConfidence = confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

    // Aggregate predictions to find consensus
    const predictions = results.map(r => r.prediction.toLowerCase());
    const malwareCount = predictions.filter(p =>
      p.includes('malware') || p.includes('trojan') || p.includes('virus') ||
      p.includes('ransomware') || p.includes('backdoor') || p.includes('stealer')
    ).length;

    const cleanCount = predictions.filter(p =>
      p.includes('clean') || p.includes('benign') || p.includes('safe')
    ).length;

    let verdict = 'Analysis inconclusive';
    if (malwareCount > cleanCount && malwareCount >= results.length / 2) {
      // Find most specific prediction
      const malwarePredictions = results.filter(r =>
        r.prediction.toLowerCase().includes('malware') ||
        r.prediction.toLowerCase().includes('trojan')
      );
      verdict = malwarePredictions[0]?.prediction || 'Potential malware detected';
    } else if (cleanCount > malwareCount && cleanCount >= results.length / 2) {
      verdict = 'File appears clean';
    }

    return { confidence: avgConfidence, verdict };
  };

  const [, setCurrentFile] = createSignal<any>(null);
  const [entropy, setEntropy] = createSignal(0);
  const [fileType, setFileType] = createSignal('');
  const [fileSize, setFileSize] = createSignal(0);
  const [packerInfo, setPackerInfo] = createSignal('None');

  // Listen for file analysis events
  onMount(() => {
    const handleFileAnalyzed = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { result } = customEvent.detail;
      updateAnalysisData(result);
    };

    window.addEventListener('file-analyzed', handleFileAnalyzed);

    return () => {
      window.removeEventListener('file-analyzed', handleFileAnalyzed);
    };
  });

  // Watch for current file changes in analysis store
  createEffect(() => {
    const files = analysisStore.files();
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      if (!latestFile) return;

      setCurrentFile(latestFile);

      if (latestFile.analysisResult) {
        updateAnalysisData(latestFile.analysisResult);
      }
    }
  });

  const updateAnalysisData = (result: any) => {
    // Update hashes
    setFileHashes({
      md5: result.hashes?.md5 || '',
      sha1: result.hashes?.sha1 || '',
      sha256: result.hashes?.sha256 || '',
      ssdeep: result.hashes?.ssdeep || ''
    });

    // Update file info
    const format = result.format || {};
    setFileInfo({
      architecture: format.architecture || 'Unknown',
      entryPoint: format.entry_point ? `0x${format.entry_point.toString(16)}` : 'N/A',
      sections: format.sections?.length || 0,
      imports: format.imports?.length || 0,
      exports: format.exports?.length || 0,
      resources: format.resources?.length || 0,
      timestamp: new Date().toISOString()
    });

    // Update other properties
    setEntropy(result.entropy || 0);
    setFileType(format.type || 'Unknown');
    setFileSize(result.size || 0);
    setPackerInfo(format.packer_info || 'None detected');

    // Update strings (limit to 10 most suspicious)
    if (result.strings?.suspicious) {
      setStrings(result.strings.suspicious.slice(0, 10));
    }

    // Extract API calls from imports
    if (format.imports) {
      const suspiciousApis = format.imports
        .filter((imp: any) => isSuspiciousApi(imp.name))
        .slice(0, 10)
        .map((imp: any) => ({
          name: imp.name,
          description: getApiDescription(imp.name)
        }));
      setApiCalls(suspiciousApis);
    }

    // Update AI ensemble results
    if (result.ai_results || result.aiResults) {
      const aiData = result.ai_results || result.aiResults;
      if (Array.isArray(aiData)) {
        setAiResults(aiData.map((r: any) => ({
          provider: r.provider || r.model || 'Unknown',
          prediction: r.prediction || r.verdict || r.result || 'No prediction',
          confidence: r.confidence ?? r.score ?? 0
        })));
      } else if (typeof aiData === 'object') {
        // Single result format
        setAiResults([{
          provider: aiData.provider || 'AI',
          prediction: aiData.prediction || aiData.verdict || 'No prediction',
          confidence: aiData.confidence ?? 0
        }]);
      }
    }
  };

  const isSuspiciousApi = (apiName: string): boolean => {
    const suspicious = [
      'CreateRemoteThread', 'VirtualAllocEx', 'WriteProcessMemory',
      'SetWindowsHookEx', 'RegCreateKeyEx', 'InternetConnect',
      'CreateFile', 'OpenProcess', 'LoadLibrary', 'GetProcAddress'
    ];
    return suspicious.some(api => apiName.includes(api));
  };

  const getApiDescription = (apiName: string): string => {
    const descriptions: Record<string, string> = {
      'CreateRemoteThread': 'Code injection',
      'VirtualAllocEx': 'Memory allocation in remote process',
      'WriteProcessMemory': 'Process manipulation',
      'SetWindowsHookEx': 'Hooking mechanism',
      'RegCreateKeyEx': 'Registry manipulation',
      'InternetConnect': 'Network activity',
      'CreateFile': 'File system access',
      'OpenProcess': 'Process access',
      'LoadLibrary': 'DLL loading',
      'GetProcAddress': 'Dynamic API resolution'
    };
    
    for (const [key, desc] of Object.entries(descriptions)) {
      if (apiName.includes(key)) return desc;
    }
    return 'System API';
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🔍 Static Analysis Results
      </h2>
      
      <div class="stats-overview" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
        <StatCard 
          value={fileType() || "Unknown"} 
          label="File Type" 
        />
        <StatCard 
          value={fileSize() > 0 ? `${(fileSize() / 1024 / 1024).toFixed(2)}MB` : "0MB"} 
          label="File Size" 
        />
        <div class="entropy-stat-card">
          <StatCard 
            value={entropy().toFixed(2)} 
            label="Entropy Score" 
          />
          <div class="entropy-bar">
            <div class="entropy-fill" style={`width: ${(entropy() / 8 * 100).toFixed(1)}%`}></div>
            <span class="entropy-label">{(entropy() / 8 * 100).toFixed(1)}%</span>
          </div>
        </div>
        <StatCard 
          value={packerInfo()} 
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
            <div class="consensus-score">
              {getConsensus().confidence > 0 ? `${getConsensus().confidence}% Confidence` : 'No data'}
            </div>
            <div style="color: var(--text-secondary);">
              <strong>Consensus:</strong> {getConsensus().verdict}
            </div>
          </div>
          
          <div class="agent-results">
            <Show when={aiResults().length > 0} fallback={
              <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                AI analysis results will appear here when analysis is complete
              </div>
            }>
              {aiResults().map(result => (
                <div class="agent-result">
                  <div class="agent-name">{result.provider}</div>
                  <div class="agent-prediction">{result.prediction}</div>
                </div>
              ))}
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaticAnalysis;