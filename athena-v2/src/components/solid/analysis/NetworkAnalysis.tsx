import { Component, createSignal, Show, For } from 'solid-js';
import NetworkTraffic from '../visualization/NetworkTraffic';
import { invoke } from '@tauri-apps/api/core';
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

  const handlePacketSelect = (packet: NetworkPacket) => {
    setSelectedPacket(packet);
    analyzePacket(packet);
  };

  const analyzePacket = async (packet: NetworkPacket) => {
    setIsAnalyzing(true);
    setAnalysisResult('');

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
      
      setAnalysisResult(analysis);
    } catch (error) {
      setAnalysisResult(`Error analyzing packet: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportCapture = async () => {
    try {
      // In a real implementation, this would export the captured packets
      await invoke('export_network_capture', { 
        format: 'pcap',
        path: `${props.filePath || 'capture'}_network.pcap`
      });
    } catch (error) {
      console.error('Failed to export capture:', error);
    }
  };

  // Mock network statistics
  const [networkStats] = createSignal({
    totalPackets: 1247,
    suspiciousPackets: 23,
    dataTransferred: '45.3 MB',
    uniqueConnections: 87
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
                filter={(packet) => {
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
                </div>
              </Show>
              <Show when={!isAnalyzing() && analysisResult()}>
                <CodeEditor content={analysisResult()} language="log" />
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
              <For each={[
                { ip: '192.168.1.100:443', count: 234, type: 'HTTPS' },
                { ip: '10.0.0.50:80', count: 189, type: 'HTTP' },
                { ip: '172.16.0.25:8080', count: 156, type: 'Custom' }
              ]}>
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
              <li class="threat-item critical">• Suspicious port scanning detected</li>
              <li class="threat-item warning">• Unusual outbound traffic pattern</li>
              <li class="threat-item warning">• Encrypted C2 communication</li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div class="artifacts-grid">
            <button class="btn btn-primary">🛡️ Block IPs</button>
            <button class="btn btn-primary">📊 Statistics</button>
            <button class="btn btn-secondary">🔍 Filter</button>
            <button class="btn btn-secondary">📝 Report</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkAnalysis;