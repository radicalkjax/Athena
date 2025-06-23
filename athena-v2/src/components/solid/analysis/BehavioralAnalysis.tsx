import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { advancedAnalysis } from '../../../services/advancedAnalysis';
import { analysisStore } from '../../../stores/analysisStore';
import type { BehavioralAnalysis, BehaviorPattern, TimelineEvent } from '../../../types/analysis';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './BehavioralAnalysis.css';

const BehavioralAnalysisComponent: Component = () => {
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [analysis, setAnalysis] = createSignal<BehavioralAnalysis | null>(null);
  const [timeline, setTimeline] = createSignal<TimelineEvent[]>([]);
  const [selectedBehavior, setSelectedBehavior] = createSignal<BehaviorPattern | null>(null);
  const [filterSeverity, setFilterSeverity] = createSignal<string>('all');

  createEffect(() => {
    const currentFile = analysisStore.currentFile;
    if (currentFile && analysis()) {
      setAnalysis(null);
      setTimeline([]);
    }
  });

  const startBehavioralAnalysis = async () => {
    const file = analysisStore.currentFile;
    if (!file || !file.fileData) return;

    setIsAnalyzing(true);
    try {
      const result = await advancedAnalysis.performAdvancedAnalysis(
        file.hash,
        file.fileData
      );
      
      setAnalysis(result.behavioral);
      setTimeline(result.timeline);
      
      analysisStore.updateProgress({
        behavioralAnalysis: {
          status: 'completed',
          progress: 100,
          result: result.behavioral
        }
      });
    } catch (error) {
      console.error('Behavioral analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#f38ba8';
      case 'high': return '#fab387';
      case 'medium': return '#f9e2af';
      case 'low': return '#a6e3a1';
      default: return '#94a3b8';
    }
  };

  const getBehaviorIcon = (type: string) => {
    switch (type) {
      case 'evasion': return '🛡️';
      case 'persistence': return '🔒';
      case 'lateral_movement': return '➡️';
      case 'data_theft': return '💾';
      case 'destruction': return '💥';
      case 'communication': return '📡';
      default: return '🔍';
    }
  };

  const filteredBehaviors = () => {
    if (!analysis()) return [];
    const behaviors = analysis()!.behaviors;
    
    if (filterSeverity() === 'all') return behaviors;
    return behaviors.filter(b => b.severity === filterSeverity());
  };

  const filteredTimeline = () => {
    if (filterSeverity() === 'all') return timeline();
    return timeline().filter(e => e.severity === filterSeverity());
  };

  return (
    <div class="content-panel">
      <div class="panel-header">
        <h3><span style="color: var(--barbie-pink)">🧠</span> Behavioral Analysis</h3>
        <p>Advanced dynamic and behavioral analysis of malware samples</p>
      </div>

      <Show when={!analysisStore.currentFile}>
        <div class="no-file-message">
          Please upload a file to analyze
        </div>
      </Show>

      <Show when={analysisStore.currentFile && !isAnalyzing() && !analysis()}>
        <button 
          class="btn-primary"
          onClick={startBehavioralAnalysis}
        >
          Start Behavioral Analysis
        </button>
      </Show>

      <Show when={isAnalyzing()}>
        <div class="analysis-progress">
          <div class="spinner"></div>
          <p>Performing behavioral analysis...</p>
          <div class="progress-steps">
            <div class="step active">🔍 Static Analysis</div>
            <div class="step active">⚡ Dynamic Execution</div>
            <div class="step">📡 Network Monitoring</div>
            <div class="step">💾 File System Tracking</div>
          </div>
        </div>
      </Show>

      <Show when={analysis()}>
        <AnalysisPanel title="Analysis Results" icon="📊" className="scrollable-panel">
          <div class="analysis-grid">
            <StatCard 
              label="Risk Score" 
              value={analysis()!.riskScore.toString()}
            />
            <StatCard 
              label="Sandbox Escape" 
              value={analysis()!.sandboxEscape ? 'Detected' : 'Not Detected'}
            />
            <StatCard 
              label="Behaviors" 
              value={analysis()!.behaviors.length.toString()}
            />
            <StatCard 
              label="Network Activity" 
              value={analysis()!.networkActivity.length.toString()}
            />
          </div>

          <div class="filter-controls">
            <label>Filter by severity:</label>
            <select 
              value={filterSeverity()}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div class="behaviors-section">
            <h4>Detected Behaviors</h4>
            <div class="behavior-grid">
              <For each={filteredBehaviors()}>
                {(behavior) => (
                  <div 
                    class={`behavior-card ${selectedBehavior() === behavior ? 'selected' : ''}`}
                    onClick={() => setSelectedBehavior(behavior)}
                  >
                    <div class="behavior-header">
                      <span class="behavior-icon">{getBehaviorIcon(behavior.type)}</span>
                      <span class="behavior-type">{behavior.type}</span>
                      <span 
                        class="severity-badge"
                        style={{ 'background-color': getSeverityColor(behavior.severity) }}
                      >
                        {behavior.severity}
                      </span>
                    </div>
                    <p class="behavior-description">{behavior.description}</p>
                    <div class="confidence-bar">
                      <div 
                        class="confidence-fill"
                        style={{ width: `${behavior.confidence * 100}%` }}
                      ></div>
                      <span class="confidence-text">
                        {Math.round(behavior.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={selectedBehavior()}>
            <div class="behavior-details">
              <h4>Behavior Evidence</h4>
              <ul class="evidence-list">
                <For each={selectedBehavior()!.evidence}>
                  {(evidence) => <li>{evidence}</li>}
                </For>
              </ul>
            </div>
          </Show>

          <div class="timeline-section">
            <h4>Execution Timeline</h4>
            <div class="timeline">
              <For each={filteredTimeline()}>
                {(event) => (
                  <div class="timeline-event">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <span class="timeline-time">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span 
                          class="timeline-severity"
                          style={{ color: getSeverityColor(event.severity) }}
                        >
                          {event.severity}
                        </span>
                      </div>
                      <div class="timeline-description">{event.description}</div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={analysis()!.persistence.length > 0}>
            <div class="persistence-section">
              <h4>Persistence Mechanisms</h4>
              <div class="persistence-list">
                <For each={analysis()!.persistence}>
                  {(mechanism) => (
                    <div class="persistence-item">
                      <div class="persistence-technique">{mechanism.technique}</div>
                      <div class="persistence-location">{mechanism.location}</div>
                      <div class="persistence-details">{mechanism.details}</div>
                      <Show when={mechanism.mitreTechnique}>
                        <div class="mitre-tag">MITRE: {mechanism.mitreTechnique}</div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class="activity-summary">
            <div class="summary-section">
              <h5>Network Activity</h5>
              <div class="activity-count">
                {analysis()!.networkActivity.filter(n => n.suspicious).length} suspicious
                / {analysis()!.networkActivity.length} total
              </div>
            </div>
            <div class="summary-section">
              <h5>File Operations</h5>
              <div class="activity-count">
                {analysis()!.fileOperations.filter(f => f.suspicious).length} suspicious
                / {analysis()!.fileOperations.length} total
              </div>
            </div>
            <div class="summary-section">
              <h5>Process Activity</h5>
              <div class="activity-count">
                {analysis()!.processActivity.filter(p => p.suspicious).length} suspicious
                / {analysis()!.processActivity.length} total
              </div>
            </div>
          </div>
        </AnalysisPanel>
      </Show>
    </div>
  );
};

export default BehavioralAnalysisComponent;