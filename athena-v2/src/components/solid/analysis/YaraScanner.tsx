import { Component, createSignal, Show, onMount, createEffect } from 'solid-js';
import { advancedAnalysis } from '../../../services/advancedAnalysis';
import { analysisStore } from '../../../stores/analysisStore';
import type { YaraMatch } from '../../../types/analysis';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invokeCommand } from '../../../utils/tauriCompat';
import './YaraScanner.css';

const YaraScanner: Component = () => {
  const [showRuleEditor] = createSignal(true);
  const [testResults, setTestResults] = createSignal<any>(null);
  const [scanResults, setScanResults] = createSignal<any[]>([]);
  const [isScanning, setIsScanning] = createSignal(false);
  const [scannerInitialized, setScannerInitialized] = createSignal(false);
  const [rulesLoaded, setRulesLoaded] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Initialize YARA scanner on mount
  onMount(async () => {
    try {
      await invokeCommand('initialize_yara_scanner');
      setScannerInitialized(true);
      
      // Load default rules
      await invokeCommand('load_default_yara_rules');
      setRulesLoaded(true);
    } catch (err) {
      setError(`Failed to initialize YARA scanner: ${err}`);
    }
  });

  // Watch for file changes to scan
  createEffect(async () => {
    const files = analysisStore.files();
    if (files.length > 0 && scannerInitialized() && rulesLoaded()) {
      const latestFile = files[files.length - 1];
      if (latestFile && latestFile.path) {
        await scanFile(latestFile.path);
      }
    }
  });

  const scanFile = async (filePath: string) => {
    setIsScanning(true);
    setError(null);
    
    try {
      const results = await invokeCommand('scan_file_with_yara', { filePath });
      setScanResults(results.matches || []);
    } catch (err) {
      setError(`YARA scan failed: ${err}`);
    } finally {
      setIsScanning(false);
    }
  };

  const testRule = () => {
    // Rule testing will be implemented with actual YARA engine
    setTestResults(null);
  };


  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        📝 YARA Rules - Signature Detection
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">

          <Show when={showRuleEditor()}>
            <AnalysisPanel 
              title="Generated YARA Rules" 
              icon="🎯" 
              className="scrollable-panel"
              actions={
                <div>
                  <button class="btn btn-secondary">📄 Save Rule</button>
                  <button class="btn btn-primary" onClick={testRule}>✅ Test Rule</button>
                </div>
              }
            >
              <div class="code-editor">
                <div class="code-content" style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
                  <pre style="margin: 0; white-space: pre-wrap;">
                    <span style="color: var(--barbie-pink)">rule Banking_Trojan_Dridex</span> {'{'}
                    <span style="color: var(--success-color)">    meta</span>:
                        <span style="color: var(--info-color)">description</span> = <span style="color: var(--warning-color)">"Detects Dridex banking trojan"</span>
                        <span style="color: var(--info-color)">author</span> = <span style="color: var(--warning-color)">"AI Analysis Engine"</span>
                        <span style="color: var(--info-color)">date</span> = <span style="color: var(--warning-color)">"{new Date().toISOString().split('T')[0]}"</span>
                        <span style="color: var(--info-color)">threat_level</span> = <span style="color: var(--warning-color)">"high"</span>
                        <span style="color: var(--info-color)">category</span> = <span style="color: var(--warning-color)">"trojan.banker"</span>
                    
                    <span style="color: var(--success-color)">    strings</span>:
                        <span style="color: var(--info-color)">$mz</span> = <span style="color: var(--warning-color)">"MZ"</span>
                        <span style="color: var(--info-color)">$string1</span> = <span style="color: var(--warning-color)">"LoadLibraryA"</span> <span style="color: var(--success-color)">nocase</span>
                        <span style="color: var(--info-color)">$string2</span> = <span style="color: var(--warning-color)">"GetProcAddress"</span> <span style="color: var(--success-color)">nocase</span>
                        <span style="color: var(--info-color)">$string3</span> = <span style="color: var(--warning-color)">"VirtualAlloc"</span>
                        <span style="color: var(--info-color)">$mutex</span> = <span style="color: var(--text-secondary)">/Global\\\\[A-F0-9]{'}{8}{'}/</span>
                        <span style="color: var(--info-color)">$api_hash</span> = {'{'}<span style="color: var(--text-secondary)">8B 45 FC 33 D2 52 50</span>{'}'}
                        
                    <span style="color: var(--success-color)">    condition</span>:
                        <span style="color: var(--info-color)">$mz</span> <span style="color: var(--success-color)">at</span> 0 <span style="color: var(--success-color)">and</span>
                        <span style="color: var(--success-color)">all of</span> (<span style="color: var(--info-color)">$string*</span>) <span style="color: var(--success-color)">and</span>
                        (<span style="color: var(--info-color)">$mutex</span> <span style="color: var(--success-color)">or</span> <span style="color: var(--info-color)">$api_hash</span>)
                    {'}'}
                  </pre>
                </div>
              </div>
            </AnalysisPanel>
          </Show>

          <Show when={testResults()}>
            <AnalysisPanel title="Rule Testing & Validation" icon="🔍" className="scrollable-panel">
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">TEST RESULTS</strong><br /><br />
                  
                  <span style="color: var(--success-color)">✅ Rule Compilation:</span> {testResults().compilation}<br />
                  <span style="color: var(--success-color)">✅ Matches Found:</span> {testResults().matches} files<br />
                  <span style="color: var(--warning-color)">⚠️ False Positives:</span> {testResults().falsePositives}<br />
                  <span style="color: var(--info-color)">⚡ Performance:</span> {testResults().performance}<br /><br />
                  
                  <strong style="color: var(--barbie-pink)">COVERAGE ANALYSIS</strong><br /><br />
                  
                  String Match Coverage: <span style="color: var(--success-color)">{testResults().coverage.strings}%</span><br />
                  Condition Logic: <span style="color: var(--success-color)">{testResults().coverage.conditions}%</span><br />
                  Detection Confidence: <span style="color: var(--success-color)">{testResults().coverage.confidence}%</span><br />
                  False Positive Risk: <span style="color: var(--warning-color)">{testResults().coverage.fpRisk}</span><br /><br />
                  
                  <strong style="color: var(--barbie-pink)">RECOMMENDATIONS</strong><br /><br />
                  
                  <span style="color: var(--info-color)">• Add more specific strings to reduce false positives</span><br />
                  <span style="color: var(--info-color)">• Consider adding file size constraints</span><br />
                  <span style="color: var(--info-color)">• Test against legitimate software samples</span><br />
                  <span style="color: var(--info-color)">• Add entropy check for packed sections</span>
                </div>
              </div>
            </AnalysisPanel>
          </Show>

        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📚 Rule Library
          </h3>
          
          <div style="background: var(--code-bg); padding: 15px; border-radius: 6px; margin-bottom: 15px; font-size: 0.85rem;">
            <strong>Scanner Status:</strong><br />
            {scannerInitialized() ? '✅ Scanner Initialized' : '⏳ Initializing...'}<br />
            {rulesLoaded() ? '✅ Rules Loaded' : '⏳ Loading Rules...'}<br />
            {isScanning() ? '⏳ Scanning in progress...' : '✅ Ready to scan'}<br /><br />
            
            <strong>Scan Results:</strong><br />
            {scanResults().length > 0 ? (
              scanResults().map(match => (
                <div>
                  ✅ {match.rule_name} - {match.severity}<br />
                </div>
              ))
            ) : (
              <span style="color: var(--text-secondary)">No matches found</span>
            )}
          </div>
          
          <Show when={error()}>
            <div style="color: var(--danger-color); margin: 10px 0;">
              {error()}
            </div>
          </Show>
          
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🛠️ Rule Actions
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary">📄 Export Rules</button>
            <button class="btn btn-secondary">🔄 Auto-Generate</button>
            <button class="btn btn-secondary">✅ Batch Test</button>
            <button class="btn btn-secondary">📊 Performance Test</button>
            <button class="btn btn-secondary">📚 Add to Library</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YaraScanner;