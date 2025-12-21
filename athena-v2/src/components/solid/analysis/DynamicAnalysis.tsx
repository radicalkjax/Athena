import { Component, createSignal, For, onMount, Show } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import VideoPlayer, { Screenshot, VideoRecording, BehaviorEvent as VideoEvent } from './VideoPlayer';
import MemoryViewer, { MemoryDump, VolatilityAnalysis } from './MemoryViewer';
import { invokeCommand } from '../../../utils/tauriCompat';
import { analysisStore } from '../../../stores/analysisStore';
import './DynamicAnalysis.css';

interface BehaviorEvent {
  type: 'success' | 'warning' | 'danger' | 'info';
  symbol: string;
  description: string;
  timestamp?: number;
  mitre_attack_id?: string;
}

interface ATTACKMapping {
  id: string;
  name: string;
  description: string;
  confidence?: number;
}

interface NetworkConnection {
  protocol: string;
  source: string;
  destination: string;
  port: number;
  connection_type: string;
}

interface SandboxStatus {
  docker_available: boolean;
  linux_sandbox_available: boolean;
  windows_sandbox_available: boolean;
  max_concurrent_sandboxes: number;
  default_timeout_secs: number;
  default_memory_limit_mb: number;
}

interface ExecutionReport {
  session_id: string;
  exit_code: number;
  execution_time_ms: number;
  behavioral_events: Array<{
    timestamp: number;
    event_type: string;
    description: string;
    severity: string;
    mitre_attack_id?: string;
  }>;
  file_operations: Array<{
    timestamp: number;
    operation: string;
    path: string;
  }>;
  network_connections: NetworkConnection[];
  processes_created: Array<{
    pid: number;
    name: string;
    command_line: string;
  }>;
  syscall_summary: Record<string, number>;
  mitre_attacks: ATTACKMapping[];
  stdout: string;
  stderr: string;
  // New fields for memory and video
  memory_dumps?: MemoryDump[];
  video_recording?: VideoRecording;
  screenshots?: Screenshot[];
}

const DynamicAnalysis: Component = () => {
  const [behaviorEvents, setBehaviorEvents] = createSignal<BehaviorEvent[]>([]);
  const [networkActivity, setNetworkActivity] = createSignal({
    dnsQueries: [] as string[],
    connections: [] as string[],
    dataTransfer: {
      outbound: 'N/A',
      inbound: 'N/A'
    }
  });
  const [mitreAttacks, setMitreAttacks] = createSignal<ATTACKMapping[]>([]);
  const [recommendations, setRecommendations] = createSignal<string[]>([]);

  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [isLoadingScreenshots, setIsLoadingScreenshots] = createSignal(false);
  const [sandboxStatus, setSandboxStatus] = createSignal<SandboxStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [lastReport, setLastReport] = createSignal<ExecutionReport | null>(null);

  // New signals for video and memory
  const [videoRecording, setVideoRecording] = createSignal<VideoRecording | null>(null);
  const [screenshots, setScreenshots] = createSignal<Screenshot[]>([]);
  const [memoryDumps, setMemoryDumps] = createSignal<MemoryDump[]>([]);
  const [volatilityResults, setVolatilityResults] = createSignal<VolatilityAnalysis | null>(null);
  const [showVideoPanel, setShowVideoPanel] = createSignal(false);
  const [showMemoryPanel, setShowMemoryPanel] = createSignal(false);

  // Check sandbox availability on mount
  onMount(async () => {
    try {
      const status = await invokeCommand('get_sandbox_status') as SandboxStatus;
      setSandboxStatus(status);
    } catch (e) {
      console.error('Failed to get sandbox status:', e);
      setSandboxStatus({
        docker_available: false,
        linux_sandbox_available: false,
        windows_sandbox_available: false,
        max_concurrent_sandboxes: 0,
        default_timeout_secs: 120,
        default_memory_limit_mb: 512
      });
    }
  });

  // Map severity to event type
  const mapSeverityToType = (severity: string): BehaviorEvent['type'] => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'success';
    }
  };

  // Map event type to symbol
  const mapEventTypeToSymbol = (eventType: string): string => {
    switch (eventType.toLowerCase()) {
      case 'filecreated':
      case 'filemodified':
        return '[FILE]';
      case 'networkconnection':
        return '[NET]';
      case 'processinjection':
      case 'codeinjection':
        return '[!!!!]';
      case 'execve':
      case 'processcreated':
        return '[EXEC]';
      case 'connect':
      case 'socket':
        return '[SOCK]';
      default:
        return '[+]';
    }
  };

  // Generate recommendations based on MITRE attacks
  const generateRecommendations = (attacks: ATTACKMapping[]): string[] => {
    const recs: string[] = [];

    for (const attack of attacks) {
      switch (attack.id) {
        case 'T1055':
          recs.push('Monitor for process injection using endpoint detection');
          break;
        case 'T1059':
          recs.push('Restrict command interpreter execution');
          break;
        case 'T1071':
          recs.push('Block suspicious outbound connections');
          break;
        case 'T1003':
          recs.push('Protect credential storage and implement MFA');
          break;
        case 'T1547':
          recs.push('Monitor boot/logon autostart locations');
          break;
        case 'T1070':
          recs.push('Preserve evidence and logs in centralized SIEM');
          break;
        case 'T1548':
          recs.push('Review and restrict privilege escalation paths');
          break;
      }
    }

    if (recs.length === 0) {
      recs.push('No specific threats detected - continue monitoring');
    }

    return [...new Set(recs)]; // Remove duplicates
  };

  // Start dynamic analysis
  const startAnalysis = async () => {
    const currentFile = analysisStore.currentFile;
    if (!currentFile?.path) {
      setError('No file selected for analysis. Please upload a file first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setBehaviorEvents([]);
    setMitreAttacks([]);
    setRecommendations([]);
    setVideoRecording(null);
    setScreenshots([]);
    setMemoryDumps([]);
    setVolatilityResults(null);

    try {
      // Add initial event
      setBehaviorEvents([{
        type: 'info',
        symbol: '[+]',
        description: `Starting sandbox analysis of ${currentFile.name}...`
      }]);

      const report = await invokeCommand('execute_sample_in_sandbox', {
        filePath: currentFile.path,
        timeoutSecs: 120,
        captureNetwork: true
      }) as ExecutionReport;

      setLastReport(report);

      // Convert behavioral events
      const events: BehaviorEvent[] = report.behavioral_events.map((e: { severity: string; event_type: string; description: string; timestamp: number; mitre_attack_id?: string }) => ({
        type: mapSeverityToType(e.severity),
        symbol: mapEventTypeToSymbol(e.event_type),
        description: e.description,
        timestamp: e.timestamp,
        mitre_attack_id: e.mitre_attack_id
      }));

      // Add file operations as events
      for (const fileOp of report.file_operations.slice(0, 20)) {
        events.push({
          type: 'info',
          symbol: '[FILE]',
          description: `${fileOp.operation}: ${fileOp.path}`
        });
      }

      // Add process creation events
      for (const proc of report.processes_created.slice(0, 10)) {
        events.push({
          type: 'warning',
          symbol: '[PROC]',
          description: `Process created: ${proc.name} (PID: ${proc.pid})`
        });
      }

      // Add completion event
      events.push({
        type: report.exit_code === 0 ? 'success' : 'warning',
        symbol: '[+]',
        description: `Analysis complete (exit code: ${report.exit_code}, duration: ${report.execution_time_ms}ms)`
      });

      setBehaviorEvents(events);

      // Set MITRE attacks
      setMitreAttacks(report.mitre_attacks);

      // Set network activity
      const networkConns: NetworkConnection[] = report.network_connections || [];
      setNetworkActivity({
        dnsQueries: networkConns
          .filter((c: NetworkConnection) => c.connection_type === 'DNS')
          .map((c: NetworkConnection) => `${c.destination} -> ${c.source}`),
        connections: networkConns
          .filter((c: NetworkConnection) => c.connection_type !== 'DNS')
          .map((c: NetworkConnection) => `${c.protocol} ${c.destination}:${c.port}`),
        dataTransfer: {
          outbound: `${networkConns.length} connections`,
          inbound: 'Analyzed'
        }
      });

      // Generate recommendations
      setRecommendations(generateRecommendations(report.mitre_attacks));

      // Handle video recording
      if (report.video_recording) {
        setVideoRecording(report.video_recording);
        setShowVideoPanel(true);
      }

      // Handle screenshots
      if (report.screenshots && report.screenshots.length > 0) {
        setScreenshots(report.screenshots);
      }

      // Handle memory dumps
      if (report.memory_dumps && report.memory_dumps.length > 0) {
        setMemoryDumps(report.memory_dumps);
        setShowMemoryPanel(true);
      }

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      setBehaviorEvents([{
        type: 'danger',
        symbol: '[!]',
        description: `Analysis failed: ${errorMsg}`
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const viewScreenshots = async () => {
    if (!lastReport()) {
      setError('Run dynamic analysis first to capture screenshots.');
      return;
    }

    // Toggle video panel to show screenshots
    if (videoRecording() || screenshots().length > 0) {
      setShowVideoPanel(!showVideoPanel());
    } else {
      setError('No video or screenshots available for this analysis.');
    }
  };

  // Handler for Volatility analysis
  const handleVolatilityAnalysis = async (dumpPath: string) => {
    try {
      const results = await invokeCommand('analyze_memory_with_volatility', {
        dump_path: dumpPath,
        plugins: ['pslist', 'malfind', 'netscan']
      }) as VolatilityAnalysis;
      setVolatilityResults(results);
    } catch (e) {
      console.error('Volatility analysis failed:', e);
      setError(e instanceof Error ? e.message : 'Volatility analysis failed');
    }
  };

  // Convert behavior events to video timeline events
  const getVideoEvents = (): VideoEvent[] => {
    return behaviorEvents().map(event => ({
      type: event.type,
      symbol: event.symbol,
      description: event.description,
      timestamp: event.timestamp,
      mitre_attack_id: event.mitre_attack_id
    }));
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        Dynamic Analysis - Docker Sandbox
      </h2>

      {/* Sandbox Status Banner */}
      <Show when={sandboxStatus()}>
        <div class={`sandbox-status-banner ${sandboxStatus()?.docker_available ? 'available' : 'unavailable'}`}>
          <Show when={sandboxStatus()?.docker_available} fallback={
            <span>Docker not available. Please install and start Docker to use dynamic analysis.</span>
          }>
            <span>Docker sandbox ready. Linux sandbox: {sandboxStatus()?.linux_sandbox_available ? 'Yes' : 'Building...'}</span>
          </Show>
        </div>
      </Show>

      {/* Error Display */}
      <Show when={error()}>
        <div class="error-banner">
          {error()}
          <button onClick={() => setError(null)} class="dismiss-btn">Dismiss</button>
        </div>
      </Show>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel
            title="Behavioral Analysis"
            icon="Running dynamic analysis"
            actions={
              <div class="action-buttons">
                <button
                  class="btn btn-primary"
                  onClick={startAnalysis}
                  disabled={isAnalyzing() || !sandboxStatus()?.docker_available}
                >
                  {isAnalyzing() ? 'Analyzing...' : 'Start Analysis'}
                </button>
                <button
                  class="btn btn-secondary"
                  onClick={viewScreenshots}
                  disabled={isLoadingScreenshots() || !lastReport()}
                >
                  {isLoadingScreenshots() ? 'Loading...' : 'View Screenshots'}
                </button>
              </div>
            }
            className="scrollable-panel"
          >
            <div class="behavioral-console">
              <Show when={behaviorEvents().length === 0}>
                <div class="console-line info">
                  [*] Select a file and click "Start Analysis" to begin sandbox execution.
                </div>
              </Show>
              <For each={behaviorEvents()}>
                {(event) => (
                  <div class={`console-line ${event.type}`}>
                    {event.symbol} {event.description}
                    <Show when={event.mitre_attack_id}>
                      <span class="mitre-tag">{event.mitre_attack_id}</span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={isAnalyzing()}>
                <div class="console-line info analyzing">
                  [*] Analysis in progress...
                </div>
              </Show>
            </div>
          </AnalysisPanel>

          <AnalysisPanel title="Network Activity" icon="Network monitoring" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content">
                <strong>DNS Queries:</strong>
                <br />
                <Show when={networkActivity().dnsQueries.length === 0}>
                  <span class="no-data">No DNS queries captured</span>
                </Show>
                <For each={networkActivity().dnsQueries}>
                  {(query) => (
                    <>
                      {query}
                      <br />
                    </>
                  )}
                </For>
                <br />
                <strong>Network Connections:</strong>
                <br />
                <Show when={networkActivity().connections.length === 0}>
                  <span class="no-data">No network connections detected</span>
                </Show>
                <For each={networkActivity().connections}>
                  {(connection) => (
                    <>
                      {connection}
                      <br />
                    </>
                  )}
                </For>
                <br />
                <strong>Summary:</strong>
                <br />
                Outbound: {networkActivity().dataTransfer.outbound}
                <br />
                Inbound: {networkActivity().dataTransfer.inbound}
              </div>
            </div>
          </AnalysisPanel>

          {/* Video Recording Panel */}
          <Show when={showVideoPanel() && (videoRecording() || screenshots().length > 0)}>
            <VideoPlayer
              videoPath={videoRecording()?.video_path || ''}
              sessionId={lastReport()?.session_id || ''}
              screenshots={screenshots()}
              events={getVideoEvents()}
              onSeekToEvent={(event) => console.log('Seek to event:', event)}
            />
          </Show>

          {/* Memory Analysis Panel */}
          <Show when={showMemoryPanel() && memoryDumps().length > 0}>
            <MemoryViewer
              memoryDumps={memoryDumps()}
              onAnalyzeWithVolatility={handleVolatilityAnalysis}
            />
          </Show>
        </div>

        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            MITRE ATT&CK Mapping
          </h3>

          <div class="mitre-attack-cards">
            <Show when={mitreAttacks().length === 0}>
              <div class="no-attacks">
                No ATT&CK techniques detected yet. Run analysis to identify threats.
              </div>
            </Show>
            <For each={mitreAttacks()}>
              {(attack) => (
                <div class="attack-card">
                  <div class="attack-header">
                    <span class="attack-id">{attack.id}</span>
                    <span class="attack-name">{attack.name}</span>
                    <Show when={attack.confidence}>
                      <span class="confidence">{Math.round((attack.confidence || 0) * 100)}%</span>
                    </Show>
                  </div>
                  <div class="attack-description">{attack.description}</div>
                </div>
              )}
            </For>
          </div>

          <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
            Recommendations
          </h3>

          <div class="ensemble-consensus">
            <div style="color: var(--text-primary);">
              <Show when={recommendations().length === 0}>
                <div>Run analysis to generate recommendations.</div>
              </Show>
              <For each={recommendations()}>
                {(rec) => <div>* {rec}</div>}
              </For>
            </div>
          </div>

          {/* Syscall Summary */}
          <Show when={lastReport()?.syscall_summary && Object.keys(lastReport()?.syscall_summary || {}).length > 0}>
            <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
              Syscall Summary
            </h3>
            <div class="syscall-summary">
              <For each={Object.entries(lastReport()?.syscall_summary || {}).slice(0, 10)}>
                {([syscall, count]) => (
                  <div class="syscall-item">
                    <span class="syscall-name">{syscall}</span>
                    <span class="syscall-count">{count}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Additional Analysis Panels Toggle */}
          <Show when={lastReport()}>
            <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
              Advanced Analysis
            </h3>
            <div class="advanced-analysis-toggles">
              <Show when={videoRecording() || screenshots().length > 0}>
                <button
                  class={`toggle-btn ${showVideoPanel() ? 'active' : ''}`}
                  onClick={() => setShowVideoPanel(!showVideoPanel())}
                >
                  Video Recording {showVideoPanel() ? '(Hide)' : '(Show)'}
                </button>
              </Show>
              <Show when={memoryDumps().length > 0}>
                <button
                  class={`toggle-btn ${showMemoryPanel() ? 'active' : ''}`}
                  onClick={() => setShowMemoryPanel(!showMemoryPanel())}
                >
                  Memory Dumps ({memoryDumps().length}) {showMemoryPanel() ? '(Hide)' : '(Show)'}
                </button>
              </Show>
              <Show when={!videoRecording() && screenshots().length === 0 && memoryDumps().length === 0}>
                <div class="no-advanced">
                  No video or memory captures available for this analysis.
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default DynamicAnalysis;
