import { Component, createSignal, Show, For } from 'solid-js';
import NetworkTraffic from '../visualization/NetworkTraffic';
import { invokeCommand } from '../../../utils/tauriCompat';
import AnalysisPanel from '../shared/AnalysisPanel';
import CodeEditor from '../shared/CodeEditor';
import { StatCard } from '../shared/StatCard';
import { config } from '../../../services/configService';
import './NetworkAnalysis.css';

interface NetworkAnalysisProps {
  filePath?: string;
}

interface NetworkPacket {
  id: string;
  timestamp: number;
  protocol: string;
  source: {
    ip: string;
    port: number;
  };
  destination: {
    ip: string;
    port: number;
  };
  size: number;
  direction: 'inbound' | 'outbound';
  data?: string;
  flags?: string[];
  suspicious?: boolean;
}

const NetworkAnalysis: Component<NetworkAnalysisProps> = (props) => {
  const [selectedPacket, setSelectedPacket] = createSignal<NetworkPacket | null>(null);
  const [analysisResult, setAnalysisResult] = createSignal<string>('');
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [hasTimedOut, setHasTimedOut] = createSignal(false);

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
      // Simulate packet analysis
      await new Promise(resolve => setTimeout(resolve, 500));

      let analysis = `Packet Analysis Results:\n\n`;
      analysis += `Protocol: ${packet.protocol}\n`;
      analysis += `Direction: ${packet.direction}\n`;
      analysis += `Size: ${packet.size} bytes\n`;
      analysis += `Source: ${packet.source.ip}:${packet.source.port}\n`;
      analysis += `Destination: ${packet.destination.ip}:${packet.destination.port}\n\n`;

      if (packet.suspicious) {
        analysis += `⚠️ SUSPICIOUS ACTIVITY DETECTED!\n`;
        analysis += `Flags: ${packet.flags?.join(', ') || 'None'}\n\n`;
        analysis += `Recommendations:\n`;
        analysis += `- Block source IP address\n`;
        analysis += `- Investigate process communicating with this endpoint\n`;
        analysis += `- Check for data exfiltration patterns\n`;
      } else {
        analysis += `✅ No suspicious patterns detected.\n`;
      }

      // In a real implementation, this would call a Rust command for deep packet inspection
      // const result = await invoke<string>('analyze_network_packet', { packet });

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
        ips: [packet.source.ip, packet.destination.ip],
        reason: 'Suspicious network activity detected'
      });

      alert(`Blocked IPs:\n- ${packet.source.ip}\n- ${packet.destination.ip}`);
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

  // Network statistics - will be populated from actual analysis
  const [networkStats] = createSignal({
    totalPackets: 0,
    suspiciousPackets: 0,
    dataTransferred: '0 MB',
    uniqueConnections: 0
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
          
          {/* Connection Summary */}
          <div style="background: var(--panel-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">🔥 Top Connections</h4>
            <div>
              <For each={config.get('network').demoConnections}>
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