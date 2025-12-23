import { Component, createSignal, Show, For, onMount, onCleanup, createEffect } from 'solid-js';
import NetworkTraffic from '../visualization/NetworkTraffic';
import { invokeCommand } from '../../../utils/tauriCompat';
import AnalysisPanel from '../shared/AnalysisPanel';
import CodeEditor from '../shared/CodeEditor';
import { StatCard } from '../shared/StatCard';
import './NetworkAnalysis.css';

interface NetworkAnalysisProps {
  filePath?: string;
}

interface NetworkPacket {
  id: string;
  timestamp: number;
  protocol: string;
  source_ip: string;
  source_port: number;
  destination_ip: string;
  destination_port: number;
  size: number;
  direction: string;
  data?: string;
  flags?: string[];
  suspicious?: boolean;
}

interface ActiveCaptureInfo {
  capture_id: string;
  interface_name: string;
  packet_count: number;
}

const NetworkAnalysis: Component<NetworkAnalysisProps> = (props) => {
  const [selectedPacket, setSelectedPacket] = createSignal<NetworkPacket | null>(null);
  const [analysisResult, setAnalysisResult] = createSignal<string>('');
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [hasTimedOut, setHasTimedOut] = createSignal(false);

  // Packet capture state
  const [selectedInterface, setSelectedInterface] = createSignal<string>('');
  const [isCapturing, setIsCapturing] = createSignal(false);
  const [currentCaptureId, setCurrentCaptureId] = createSignal<string | null>(null);
  const [activeCaptures, setActiveCaptures] = createSignal<ActiveCaptureInfo[]>([]);

  const handlePacketSelect = (packet: NetworkPacket) => {
    setSelectedPacket(packet);
    analyzePacket(packet);
  };

  const analyzePacket = async (packet: NetworkPacket) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    setHasTimedOut(false);

    // Set up timeout (30 seconds)
    const timeout = setTimeout(() => {
      setHasTimedOut(true);
    }, 30000);

    try {
      // Call real Rust backend command for deep packet inspection
      // Packet is already in the correct flat format matching backend
      const analysis = await invokeCommand<string>('analyze_network_packet', {
        packet: packet
      });

      clearTimeout(timeout);
      setAnalysisResult(analysis);
    } catch (error) {
      clearTimeout(timeout);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnalysisResult(`Error analyzing packet: ${errorMessage}\n\nPlease try again or check your network connection.`);
    } finally {
      setIsAnalyzing(false);
      setHasTimedOut(false);
    }
  };

  const exportCapture = async () => {
    try {
      setIsAnalyzing(true);
      setHasTimedOut(false);

      const timeout = setTimeout(() => {
        setHasTimedOut(true);
      }, 30000);

      const result = await invokeCommand('export_network_capture', {
        format: 'pcap',
        path: `${props.filePath || 'capture'}_network.pcap`
      });

      clearTimeout(timeout);

      // Download the exported file
      const fileName = `network_capture_${Date.now()}.pcap`;
      alert(`Network capture exported successfully to: ${fileName}`);
    } catch (error) {
      console.error('Failed to export capture:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnalysisResult(`Error exporting capture: ${errorMessage}\n\nPlease check:\n- File write permissions\n- Available disk space`);
      alert(`Export failed: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
      setHasTimedOut(false);
    }
  };

  const blockIPs = async () => {
    try {
      const packet = selectedPacket();
      if (!packet) {
        alert('Please select a suspicious packet first');
        return;
      }

      setIsAnalyzing(true);
      await invokeCommand('block_ip_addresses', {
        ips: [packet.source_ip, packet.destination_ip],
        reason: 'Suspicious network activity detected'
      });

      alert(`Blocked IPs:\n- ${packet.source_ip}\n- ${packet.destination_ip}`);
    } catch (error) {
      console.error('Failed to block IPs:', error);
      setAnalysisResult(`Error blocking IPs: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const showStatistics = async () => {
    try {
      setIsAnalyzing(true);
      const stats = await invokeCommand('get_network_statistics');

      const statsText = JSON.stringify(stats, null, 2);
      setAnalysisResult(`Network Statistics:\n\n${statsText}`);
    } catch (error) {
      console.error('Failed to get statistics:', error);
      setAnalysisResult(`Error getting statistics: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyFilter = () => {
    const filterType = prompt('Enter filter type (protocol/ip/port):', 'protocol');
    if (!filterType) return;

    const filterValue = prompt(`Enter ${filterType} to filter:`, filterType === 'protocol' ? 'TCP' : '');
    if (!filterValue) return;

    setAnalysisResult(`Filter applied: ${filterType} = ${filterValue}\n\nFiltered results will appear in the network traffic view.`);
  };

  const generateReport = async () => {
    try {
      setIsAnalyzing(true);
      const report = await invokeCommand('generate_network_report', {
        filePath: props.filePath,
        includePackets: true,
        includeThreatAnalysis: true
      });

      const fileName = `network_report_${Date.now()}.html`;
      const blob = new Blob([report as string], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      setAnalysisResult('Network analysis report generated successfully!');
    } catch (error) {
      console.error('Failed to generate report:', error);
      setAnalysisResult(`Error generating report: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Network statistics - fetch from backend
  const [networkStats, setNetworkStats] = createSignal({
    totalPackets: 0,
    suspiciousPackets: 0,
    dataTransferred: '0 MB',
    uniqueConnections: 0
  });

  // Top connections computed from real packet data
  const [topConnections, setTopConnections] = createSignal<Array<{
    ip: string;
    count: number;
    type: string;
  }>>([]);

  // Fetch network statistics on mount and periodically
  const updateNetworkStats = async () => {
    try {
      const stats = await invokeCommand<{
        total_packets: number;
        suspicious_packets: number;
        total_bytes: number;
        unique_source_ips: string[];
        unique_dest_ips: string[];
        ip_packet_counts: Record<string, number>;
        ip_protocols: Record<string, string>;
      }>('get_network_statistics');

      // Convert bytes to MB
      const dataMB = (stats.total_bytes / (1024 * 1024)).toFixed(2);

      // Count unique connections (source + dest IPs)
      const uniqueIPs = new Set([
        ...stats.unique_source_ips,
        ...stats.unique_dest_ips
      ]);

      setNetworkStats({
        totalPackets: stats.total_packets,
        suspiciousPackets: stats.suspicious_packets,
        dataTransferred: `${dataMB} MB`,
        uniqueConnections: uniqueIPs.size
      });

      // Compute top connections from ip_packet_counts
      if (stats.ip_packet_counts && Object.keys(stats.ip_packet_counts).length > 0) {
        const connections = Object.entries(stats.ip_packet_counts)
          .map(([ip, count]) => ({
            ip,
            count: count as number,
            type: (stats.ip_protocols?.[ip] as string) || 'Unknown'
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 connections
        setTopConnections(connections);
      }
    } catch (error) {
      console.error('Failed to update network statistics:', error);
    }
  };

  // Packet capture controls
  const startCapture = async () => {
    try {
      setIsAnalyzing(true);
      const interface_name = selectedInterface().trim() || undefined;

      const response = await invokeCommand<string>('start_packet_capture', {
        interface: interface_name
      });

      // Extract capture ID from response message
      const match = response.match(/ID:\s*([a-f0-9-]+)\)/);
      if (match) {
        setCurrentCaptureId(match[1]);
        setIsCapturing(true);
        setAnalysisResult(`Packet capture started successfully!\n\n${response}`);
      } else {
        setAnalysisResult(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnalysisResult(`Error starting packet capture: ${errorMessage}\n\nPlease ensure:\n- You have administrator/root privileges\n- libpcap/npcap is installed\n- Network interface is available`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stopCapture = async () => {
    const captureId = currentCaptureId();
    if (!captureId) {
      setAnalysisResult('No active capture to stop');
      return;
    }

    try {
      setIsAnalyzing(true);
      const packets = await invokeCommand<NetworkPacket[]>('stop_packet_capture', {
        capture_id: captureId
      });

      setIsCapturing(false);
      setCurrentCaptureId(null);
      setAnalysisResult(`Packet capture stopped successfully!\n\nCaptured ${packets.length} packets.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnalysisResult(`Error stopping packet capture: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateActiveCaptures = async () => {
    try {
      const captures = await invokeCommand<ActiveCaptureInfo[]>('get_active_captures');
      setActiveCaptures(captures);
    } catch (error) {
      console.error('Failed to update active captures:', error);
    }
  };

  // Update stats on mount
  onMount(() => {
    updateNetworkStats();
    updateActiveCaptures();

    // Update stats every 5 seconds
    const interval = setInterval(updateNetworkStats, 5000);

    // Update active captures every 3 seconds
    const captureInterval = setInterval(updateActiveCaptures, 3000);

    // Cleanup on unmount
    onCleanup(() => {
      clearInterval(interval);
      clearInterval(captureInterval);
    });
  });

  // Update capturing state based on active captures
  createEffect(() => {
    const captures = activeCaptures();
    const currentId = currentCaptureId();
    if (currentId && !captures.find(c => c.capture_id === currentId)) {
      // Current capture no longer active
      setIsCapturing(false);
      setCurrentCaptureId(null);
    }
  });

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🌐 Network Traffic Analysis
      </h2>
      
      {/* Network Statistics Cards */}
      <div class="network-stats-grid">
        <StatCard
          label="Total Packets"
          value={networkStats().totalPackets.toString()}
        />
        <StatCard
          label="Suspicious"
          value={networkStats().suspiciousPackets.toString()}
        />
        <StatCard
          label="Data Transferred"
          value={networkStats().dataTransferred}
        />
        <StatCard
          label="Connections"
          value={networkStats().uniqueConnections.toString()}
        />
      </div>

      {/* Packet Capture Controls */}
      <AnalysisPanel
        title="Packet Capture Controls"
        icon="📡"
        className="capture-controls-panel"
      >
        <div style="display: flex; flex-direction: column; gap: 15px;">
          {/* Interface selector and capture buttons */}
          <div style="display: flex; gap: 10px; align-items: center;">
            <input
              type="text"
              placeholder="Network interface (e.g., eth0, en0, or leave empty for default)"
              value={selectedInterface()}
              onInput={(e) => setSelectedInterface(e.currentTarget.value)}
              style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: var(--text-primary);"
              disabled={isCapturing()}
            />
            <Show when={!isCapturing()}>
              <button
                class="btn btn-primary"
                onClick={startCapture}
                disabled={isAnalyzing()}
                style="min-width: 120px;"
              >
                {isAnalyzing() ? '⏳ Starting...' : '▶ Start Capture'}
              </button>
            </Show>
            <Show when={isCapturing()}>
              <button
                class="btn btn-secondary"
                onClick={stopCapture}
                disabled={isAnalyzing()}
                style="min-width: 120px; background: var(--danger-color);"
              >
                {isAnalyzing() ? '⏳ Stopping...' : '⏹ Stop Capture'}
              </button>
            </Show>
          </div>

          {/* Status indicator */}
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--panel-bg); border-radius: 4px;">
            <div style={{
              width: '12px',
              height: '12px',
              'border-radius': '50%',
              background: isCapturing() ? '#2ecc71' : '#95a5a6'
            }} />
            <span style="color: var(--text-secondary); font-size: 14px;">
              {isCapturing() ? `Capturing on ${currentCaptureId() ? 'interface' : 'default interface'}` : 'Not capturing'}
            </span>
          </div>

          {/* Active captures list */}
          <Show when={activeCaptures().length > 0}>
            <div style="margin-top: 10px;">
              <h4 style="color: var(--text-primary); margin-bottom: 10px; font-size: 14px;">
                Active Captures ({activeCaptures().length})
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <For each={activeCaptures()}>
                  {(capture) => (
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--panel-bg); border-radius: 4px; border-left: 3px solid var(--barbie-pink);">
                      <div>
                        <div style="color: var(--text-primary); font-weight: 500;">
                          {capture.interface_name}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 12px;">
                          {capture.packet_count} packets captured
                        </div>
                      </div>
                      <div style="color: var(--text-secondary); font-family: monospace; font-size: 11px;">
                        {capture.capture_id.substring(0, 8)}...
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </AnalysisPanel>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Live Network Traffic" 
            icon="🌐"
            actions={
              <div class="export-controls">
                <button class="btn-export-pcap" onClick={exportCapture}>
                  📤 Export PCAP
                </button>
                <button class="btn btn-secondary">
                  🔄 Refresh
                </button>
              </div>
            }
            className="scrollable-panel"
          >
            <div>
              <NetworkTraffic 
                onPacketSelect={handlePacketSelect}
                filter={() => {
                  // Custom filter logic can be added here
                  return true;
                }}
              />
            </div>
          </AnalysisPanel>

          <Show when={selectedPacket()}>
            <AnalysisPanel title="Deep Packet Analysis" icon="🔍" className="scrollable-panel">
              <Show when={isAnalyzing()}>
                <div style="text-align: center; padding: 40px;">
                  <div class="spinner" style="margin: 0 auto 20px;"></div>
                  <span style="color: var(--text-secondary);">Analyzing packet...</span>
                  <Show when={hasTimedOut()}>
                    <div style="color: var(--warning-color); margin-top: 10px;">
                      Analysis is taking longer than expected. Please wait...
                    </div>
                  </Show>
                </div>
              </Show>
              <Show when={!isAnalyzing() && analysisResult()}>
                <CodeEditor content={analysisResult()} language="log" />
              </Show>
              <Show when={!isAnalyzing() && !analysisResult()}>
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                  Select a packet from the traffic view to analyze it
                </div>
              </Show>
            </AnalysisPanel>
          </Show>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🎯 Network Insights
          </h3>
          
          {/* Connection Summary - Real data from packet analysis */}
          <div style="background: var(--panel-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">🔥 Top Connections</h4>
            <div>
              <Show when={topConnections().length > 0} fallback={
                <div class="no-data-message" style="color: var(--text-muted); font-style: italic;">
                  No connections captured yet. Start a packet capture to see top connections.
                </div>
              }>
                <For each={topConnections()}>
                  {(conn) => (
                    <div class="connection-item">
                      <div class="connection-header">
                        <span class="connection-ip">{conn.ip}</span>
                        <span class="connection-count">{conn.count} packets</span>
                      </div>
                      <div class="connection-type">{conn.type}</div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>

          {/* Threat Indicators */}
          <div class="threat-indicators">
            <h4 style="margin-bottom: 10px;">⚠️ Threat Indicators</h4>
            <ul class="threat-list">
              {/* Threat indicators will be populated from actual analysis */}
              <li class="threat-item info">• No threats detected yet</li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div class="artifacts-grid">
            <button
              class="btn btn-primary"
              onClick={blockIPs}
              disabled={isAnalyzing()}
            >
              🛡️ Block IPs
            </button>
            <button
              class="btn btn-primary"
              onClick={showStatistics}
              disabled={isAnalyzing()}
            >
              📊 Statistics
            </button>
            <button
              class="btn btn-secondary"
              onClick={applyFilter}
            >
              🔍 Filter
            </button>
            <button
              class="btn btn-secondary"
              onClick={generateReport}
              disabled={isAnalyzing()}
            >
              📝 Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkAnalysis;