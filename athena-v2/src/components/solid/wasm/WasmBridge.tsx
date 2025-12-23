import { Component, createSignal, onMount, Show } from 'solid-js';
import { wasmService } from '../../../services/wasmService';
import type { WasmAnalysisRequest, WasmAnalysisResult } from '../../../types/wasm';
import './WasmBridge.css';

interface Props {
  fileData?: Uint8Array;
  analysisType: 'static' | 'dynamic' | 'network' | 'behavioral';
  onAnalysisComplete?: (result: WasmAnalysisResult) => void;
}

const WasmBridge: Component<Props> = (props) => {
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [currentPhase, setCurrentPhase] = createSignal('');
  const [result, setResult] = createSignal<WasmAnalysisResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    // Ensure WASM runtime is initialized
    try {
      await wasmService.initializeRuntime();
    } catch (err) {
      console.error('Failed to initialize WASM runtime:', err);
    }
  });

  const startAnalysis = async () => {
    if (!props.fileData || isAnalyzing()) return;

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);
    setResult(null);

    try {
      // Show initial loading state
      setCurrentPhase('Initializing WASM runtime...');
      setProgress(10);

      // Prepare analysis request
      const request: WasmAnalysisRequest = {
        fileData: props.fileData,
        analysisType: props.analysisType,
        options: {
          timeout: 30000,
          memoryLimit: 100 * 1024 * 1024, // 100MB
          enableInstrumentation: true,
        },
      };

      setCurrentPhase('Loading analysis module...');
      setProgress(20);

      setCurrentPhase(`Running ${props.analysisType} analysis...`);
      setProgress(30);

      const analysisResult = await wasmService.analyzeWithWasm(request);

      // Complete
      setProgress(100);
      setCurrentPhase('Analysis complete');
      setResult(analysisResult);

      if (props.onAnalysisComplete) {
        props.onAnalysisComplete(analysisResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setCurrentPhase('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6666';
      case 'medium': return '#ffaa66';
      case 'low': return '#66ff66';
      default: return '#ffffff';
    }
  };

  return (
    <div class="wasm-bridge">
      <div class="bridge-header">
        <h3>WASM Analysis Engine</h3>
        <span class="analysis-type">{props.analysisType.toUpperCase()}</span>
      </div>

      <Show when={!result()}>
        <div class="analysis-controls">
          <button
            class="btn-analyze"
            onClick={startAnalysis}
            disabled={!props.fileData || isAnalyzing()}
          >
            {isAnalyzing() ? 'Analyzing...' : 'Start WASM Analysis'}
          </button>
        </div>
      </Show>

      <Show when={isAnalyzing()}>
        <div class="analysis-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              style={{ width: `${progress()}%` }}
            />
          </div>
          <p class="progress-phase">{currentPhase()}</p>
          <p class="progress-percent">{Math.round(progress())}%</p>
        </div>
      </Show>

      <Show when={error()}>
        <div class="error-box">
          <h4>Analysis Error</h4>
          <p>{error()}</p>
        </div>
      </Show>

      <Show when={result()}>
        <div class="analysis-results">
          <div class="results-header">
            <h4>Analysis Results</h4>
            <span class="result-time">
              Completed in {result()!.metrics.executionTime}ms
            </span>
          </div>

          <div class="results-metrics">
            <div class="metric">
              <span class="metric-label">Memory Used:</span>
              <span class="metric-value">
                {(result()!.metrics.memoryUsed / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div class="metric">
              <span class="metric-label">Findings:</span>
              <span class="metric-value">{result()!.findings.length}</span>
            </div>
          </div>

          <Show when={result()!.findings.length > 0}>
            <div class="findings-list">
              <h5>Security Findings</h5>
              {result()!.findings.map((finding) => (
                <div class="finding-item">
                  <div class="finding-header">
                    <span 
                      class="severity-badge"
                      style={{ 'background-color': getSeverityColor(finding.severity) }}
                    >
                      {finding.severity.toUpperCase()}
                    </span>
                    <span class="finding-category">{finding.category}</span>
                  </div>
                  <p class="finding-description">{finding.description}</p>
                  <Show when={finding.evidence}>
                    <div class="finding-evidence">
                      <details>
                        <summary>View Evidence</summary>
                        <pre>{JSON.stringify(finding.evidence, null, 2)}</pre>
                      </details>
                    </div>
                  </Show>
                </div>
              ))}
            </div>
          </Show>

          <Show when={result()!.findings.length === 0}>
            <div class="no-findings">
              <p>No security issues detected in this analysis.</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default WasmBridge;