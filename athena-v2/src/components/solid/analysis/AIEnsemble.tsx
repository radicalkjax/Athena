import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import { aiService } from '../../../services/aiService';
import type { AIProvider, EnsembleAnalysisResult, AIAnalysisResult } from '../../../types/ai';
import './AIEnsemble.css';

const AIEnsemble: Component = () => {
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [analysisResult, setAnalysisResult] = createSignal<EnsembleAnalysisResult | null>(null);
  const [selectedProviders] = createSignal<AIProvider[]>([
    'claude', 'gpt4', 'deepseek', 'gemini', 'mistral', 'llama'
  ]);
  const [error, setError] = createSignal<string | null>(null);

  const providers: { id: AIProvider; name: string; icon: string; confidence?: number }[] = [
    { id: 'claude', name: 'Claude 3.5 Sonnet', icon: '🤖', confidence: 92 },
    { id: 'gpt4', name: 'GPT-4 Turbo', icon: '🧠', confidence: 95 },
    { id: 'deepseek', name: 'DeepSeek V3', icon: '🔍', confidence: 96 },
    { id: 'gemini', name: 'Gemini Pro', icon: '🌟', confidence: 97 },
    { id: 'mistral', name: 'Claude 3 Opus', icon: '💎', confidence: 93 },
    { id: 'llama', name: 'GPT-4o', icon: '⚡', confidence: 94 }
  ];

  createEffect(() => {
    const currentFile = analysisStore.currentFile;
    if (currentFile && analysisResult()) {
      setAnalysisResult(null);
      setError(null);
    }
  });

  const startEnsembleAnalysis = async () => {
    const file = analysisStore.currentFile;
    if (!file) {
      setError('Please upload a file to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Run AI analysis through the AI service
      const ensembleResult = await aiService.analyzeWithEnsemble({
        fileHash: file.hash,
        fileName: file.name,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.type,
        analysisType: 'comprehensive',
        providers: selectedProviders(),
        priority: 'high'
      }, 'voting');

      // Convert to EnsembleAnalysisResult format
      const result: EnsembleAnalysisResult = {
        id: `ensemble-${file.hash}-${Date.now()}`,
        fileHash: file.hash,
        timestamp: Date.now(),
        providers: selectedProviders(),
        individualResults: ensembleResult.individual,
        consensusResult: {
          confidence: ensembleResult.consensus.confidence,
          threatLevel: ensembleResult.consensus.threatLevel,
          malwareFamily: ensembleResult.consensus.malwareFamily,
          malwareType: ensembleResult.consensus.malwareType,
          aggregatedSignatures: ensembleResult.consensus.signatures,
          aggregatedBehaviors: ensembleResult.consensus.behaviors,
          aggregatedIocs: ensembleResult.consensus.iocs,
          summary: `${ensembleResult.consensus.malwareFamily || 'Unknown'} - ${ensembleResult.consensus.malwareType || 'Suspicious'}`
        },
        disagreements: findDisagreements(ensembleResult.individual)
      };

      setAnalysisResult(result);
      
      analysisStore.updateProgress({
        aiAnalysis: {
          status: 'completed',
          progress: 100,
          result: result.consensusResult
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const findDisagreements = (results: AIAnalysisResult[]) => {
    const disagreements: any[] = [];
    const fields = ['threatLevel', 'malwareFamily', 'malwareType'] as const;
    
    for (const field of fields) {
      const values = new Map<string, AIProvider[]>();
      
      results.forEach(result => {
        const value = result[field] || 'unknown';
        const providers = values.get(value) || [];
        providers.push(result.provider);
        values.set(value, providers);
      });
      
      if (values.size > 1) {
        for (const [value, providers] of values) {
          if (providers.length === 1) {
            disagreements.push({
              provider: providers[0],
              field,
              value
            });
          }
        }
      }
    }
    
    return disagreements;
  };


  // Color mapping for providers
  const providerColors: Record<AIProvider, string> = {
    'claude': '#74b9ff',
    'gpt4': '#fd79a8',
    'deepseek': '#e17055',
    'gemini': '#00b894',
    'mistral': '#fdcb6e',
    'llama': '#6c5ce7'
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🤖 AI Provider Ensemble Analysis
      </h2>
      
      {error() && (
        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid var(--danger-color); padding: 10px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="color: var(--danger-color);">Error:</strong> {error()}
        </div>
      )}
      
      <Show when={analysisResult()}>
        <div class="ensemble-consensus" style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="consensus-score">{Math.round(analysisResult()!.consensusResult.confidence * 100)}% Consensus</div>
            <div style="color: var(--success-color); font-weight: 600;">
              {analysisResult()!.individualResults.filter(r => r.confidence > 0).length}/{analysisResult()!.providers.length} Providers Agreement
            </div>
          </div>
          <div style="color: var(--text-secondary);">
            <strong>Final Classification:</strong> {analysisResult()!.consensusResult.summary}
          </div>
        </div>
      </Show>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <div class="analysis-panel">
            <div class="panel-header">
              <h3 class="panel-title">
                <span aria-hidden="true">🧠</span>
                AI Provider Insights
              </h3>
            </div>
            
            <div class="panel-content">
              <div style="display: grid; gap: 15px;">
                <Show when={analysisResult()} fallback={
                  <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    {isAnalyzing() ? 'Analyzing with AI providers...' : 'No analysis results yet. Click "Run Analysis" to start.'}
                  </div>
                }>
                  <For each={analysisResult()!.individualResults}>
                    {(result) => {
                      const providerInfo = providers.find(p => p.id === result.provider);
                      const color = providerColors[result.provider] || '#74b9ff';

                      return (
                        <div style={`background: var(--code-bg); padding: 15px; border-radius: 6px; border-left: 4px solid ${color};`}>
                          <h4 style={`color: ${color}; margin-bottom: 8px;`}>
                            {providerInfo?.icon} {providerInfo?.name} - {Math.round(result.confidence * 100)}% Confidence
                          </h4>
                          <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 8px 0;">
                            <strong>Threat Level:</strong> {result.threatLevel} |
                            <strong>Family:</strong> {result.malwareFamily || 'Unknown'} |
                            <strong>Type:</strong> {result.malwareType || 'Unknown'}
                          </p>
                          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 8px 0;">
                            <strong>Signatures:</strong> {result.signatures.slice(0, 3).join(', ') || 'None detected'}
                          </p>
                          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                            <strong>Recommendations:</strong> {result.recommendations.slice(0, 2).join('. ')}
                          </p>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            </div>
          </div>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 Ensemble Metrics
          </h3>
          
          <div class="stats-overview" style="grid-template-columns: 1fr;">
            <div class="stat-card">
              <div class="stat-value">
                {analysisResult() ? `${Math.round(analysisResult()!.consensusResult.confidence * 100)}%` : '0%'}
              </div>
              <div class="stat-label">Final Confidence</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">
                {analysisResult() ? 
                  `${analysisResult()!.individualResults.filter(r => r.confidence > 0).length}/${analysisResult()!.providers.length}` : 
                  '0/0'
                }
              </div>
              <div class="stat-label">Provider Agreement</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">
                {analysisResult() && analysisResult()!.disagreements.length > 0 ? 
                  analysisResult()!.disagreements.length : 
                  '0'
                }
              </div>
              <div class="stat-label">Disagreements</div>
            </div>
          </div>
          
          <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
            🎯 Generated Artifacts
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-primary">
              📝 Download YARA Rules
            </button>
            <button class="btn btn-secondary">
              🚨 Export IOCs
            </button>
            <button class="btn btn-secondary">
              📊 Generate Report
            </button>
            <button class="btn btn-secondary" onClick={startEnsembleAnalysis} disabled={isAnalyzing() || !analysisStore.currentFile}>
              🔄 {isAnalyzing() ? 'Analyzing...' : analysisResult() ? 'Rerun Analysis' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIEnsemble;