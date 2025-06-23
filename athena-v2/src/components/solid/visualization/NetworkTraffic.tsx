import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import './NetworkTraffic.css';

interface NetworkPacket {
  id: string;
  timestamp: number;
  protocol: 'TCP' | 'UDP' | 'HTTP' | 'HTTPS' | 'DNS' | 'Other';
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

interface NetworkStats {
  totalPackets: number;
  totalBytes: number;
  packetsPerSecond: number;
  bytesPerSecond: number;
  protocolDistribution: Record<string, number>;
}

interface NetworkTrafficProps {
  onPacketSelect?: (packet: NetworkPacket) => void;
  filter?: (packet: NetworkPacket) => boolean;
}

const NetworkTraffic: Component<NetworkTrafficProps> = (props) => {
  const [packets, setPackets] = createStore<NetworkPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = createSignal<NetworkPacket | null>(null);
  const [stats, setStats] = createStore<NetworkStats>({
    totalPackets: 0,
    totalBytes: 0,
    packetsPerSecond: 0,
    bytesPerSecond: 0,
    protocolDistribution: {}
  });
  const [isCapturing, setIsCapturing] = createSignal(false);
  const [filter, setFilter] = createSignal('');
  const [protocolFilter, setProtocolFilter] = createSignal<string>('All');
  
  let intervalId: number | null = null;
  let packetsInLastSecond: NetworkPacket[] = [];

  const protocolColors: Record<string, string> = {
    TCP: '#ff6b9d',
    UDP: '#74b9ff',
    HTTP: '#feca57',
    HTTPS: '#48dbfb',
    DNS: '#ff9ff3',
    Other: '#dfe6e9'
  };

  const generateMockPacket = (): NetworkPacket => {
    const protocols: NetworkPacket['protocol'][] = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'Other'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const isSuspicious = Math.random() < 0.1; // 10% chance of suspicious
    
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      protocol,
      source: {
        ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        port: Math.floor(Math.random() * 65535)
      },
      destination: {
        ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        port: protocol === 'HTTP' ? 80 : protocol === 'HTTPS' ? 443 : Math.floor(Math.random() * 65535)
      },
      size: Math.floor(Math.random() * 1500) + 60,
      direction: Math.random() < 0.5 ? 'inbound' : 'outbound',
      suspicious: isSuspicious,
      flags: isSuspicious ? ['MALFORMED', 'SUSPICIOUS_PATTERN'] : undefined
    };
  };

  const updateStats = () => {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    packetsInLastSecond = packetsInLastSecond.filter(p => p.timestamp > oneSecondAgo);
    
    const protocolDist: Record<string, number> = {};
    packets.forEach(packet => {
      protocolDist[packet.protocol] = (protocolDist[packet.protocol] || 0) + 1;
    });
    
    setStats({
      totalPackets: packets.length,
      totalBytes: packets.reduce((sum, p) => sum + p.size, 0),
      packetsPerSecond: packetsInLastSecond.length,
      bytesPerSecond: packetsInLastSecond.reduce((sum, p) => sum + p.size, 0),
      protocolDistribution: protocolDist
    });
  };

  const startCapture = () => {
    setIsCapturing(true);
    
    intervalId = setInterval(() => {
      const newPacket = generateMockPacket();
      packetsInLastSecond.push(newPacket);
      
      setPackets(prev => {
        const updated = [...prev, newPacket];
        // Keep only last 1000 packets for performance
        return updated.slice(-1000);
      });
      
      updateStats();
    }, 100) as unknown as number; // Generate 10 packets per second
  };

  const stopCapture = () => {
    setIsCapturing(false);
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const clearPackets = () => {
    setPackets([]);
    packetsInLastSecond = [];
    updateStats();
  };

  const filteredPackets = () => {
    let result = packets;
    
    // Protocol filter
    if (protocolFilter() !== 'All') {
      result = result.filter(p => p.protocol === protocolFilter());
    }
    
    // Text filter
    const filterText = filter().toLowerCase();
    if (filterText) {
      result = result.filter(p => 
        p.source.ip.includes(filterText) ||
        p.destination.ip.includes(filterText) ||
        p.protocol.toLowerCase().includes(filterText)
      );
    }
    
    // Custom filter from props
    if (props.filter) {
      result = result.filter(props.filter);
    }
    
    return result.slice().reverse(); // Show newest first
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePacketClick = (packet: NetworkPacket) => {
    setSelectedPacket(packet);
    props.onPacketSelect?.(packet);
  };

  onMount(() => {
    // Auto-start capture for demo
    startCapture();
  });

  onCleanup(() => {
    stopCapture();
  });

  return (
    <div style="display: flex; flex-direction: column; height: 100%; background: #1a1a1a; border-radius: 8px; overflow: hidden; font-family: 'JetBrains Mono', monospace;">
      <div style="background: #2a2a2a; border-bottom: 2px solid #ff6b9d; padding: 16px; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button 
              style={`padding: 8px 16px; background: ${isCapturing() ? '#e74c3c' : '#ff6b9d'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; ${isCapturing() ? 'animation: pulse 1s ease-in-out infinite;' : ''}`}
              onClick={() => isCapturing() ? stopCapture() : startCapture()}
            >
              {isCapturing() ? '⏸ Stop' : '▶ Capture'}
            </button>
            <button 
              style="padding: 8px 16px; background: #3a3a3a; color: #ff6b9d; border: 1px solid #ff6b9d; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;"
              onClick={clearPackets}
            >
              🗑 Clear
            </button>
            <select 
              style="padding: 8px 12px; background: #3a3a3a; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; font-size: 14px; outline: none;"
              value={protocolFilter()}
              onChange={(e) => setProtocolFilter(e.currentTarget.value)}
            >
              <option value="All">All Protocols</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="HTTP">HTTP</option>
              <option value="HTTPS">HTTPS</option>
              <option value="DNS">DNS</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="text"
              style="padding: 8px 12px; background: #3a3a3a; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; font-size: 14px; outline: none; width: 200px;"
              placeholder="Filter by IP or protocol..."
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
          </div>
          
          <div style="display: flex; gap: 24px; align-items: center;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <span style="font-size: 12px; color: #888; text-transform: uppercase;">Packets:</span>
              <span style="font-size: 18px; font-weight: 600; color: #ff6b9d;">{stats.totalPackets}</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <span style="font-size: 12px; color: #888; text-transform: uppercase;">Total:</span>
              <span style="font-size: 18px; font-weight: 600; color: #ff6b9d;">{formatBytes(stats.totalBytes)}</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <span style="font-size: 12px; color: #888; text-transform: uppercase;">Rate:</span>
              <span style="font-size: 18px; font-weight: 600; color: #ff6b9d;">{stats.packetsPerSecond} pkt/s</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 20px; padding: 20px; background: #252525; border-bottom: 1px solid #444; flex-shrink: 0;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 12px 0; color: #ff6b9d; font-size: 14px; text-transform: uppercase;">Protocol Distribution</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <For each={Object.entries(stats.protocolDistribution)}>
              {([protocol, count]) => {
                const percentage = (count / stats.totalPackets) * 100;
                return (
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 60px; font-size: 12px; color: #e0e0e0;">{protocol}</div>
                    <div style="flex: 1; height: 20px; background: #3a3a3a; border-radius: 10px; overflow: hidden;">
                      <div 
                        style={{
                          height: '100%',
                          width: `${percentage}%`,
                          'background-color': protocolColors[protocol] || protocolColors.Other,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                    <div style="width: 50px; text-align: right; font-size: 12px; color: #888;">{count}</div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; background: #2a2a2a; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #888; border-bottom: 1px solid #444; flex-shrink: 0;">
          <div style="width: 120px;">Time</div>
          <div style="width: 80px;">Protocol</div>
          <div style="flex: 1;">Source</div>
          <div style="flex: 1;">Destination</div>
          <div style="width: 80px;">Size</div>
          <div style="width: 100px; text-align: center;">Direction</div>
        </div>
        
        <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
          <For each={filteredPackets()}>
            {(packet) => (
              <div 
                style={`display: flex; padding: 8px 16px; border-bottom: 1px solid #333; font-size: 13px; cursor: pointer; transition: all 0.2s ease; ${packet.suspicious ? 'background-color: rgba(231, 76, 60, 0.1); border-left: 3px solid #e74c3c;' : ''} ${selectedPacket()?.id === packet.id ? 'background-color: rgba(255, 107, 157, 0.2); border-left: 3px solid #ff6b9d;' : ''}`}
                onClick={() => handlePacketClick(packet)}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 107, 157, 0.1)'}
                onMouseOut={(e) => {
                  if (packet.suspicious) {
                    e.currentTarget.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
                  } else if (selectedPacket()?.id === packet.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 107, 157, 0.2)';
                  } else {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style="width: 120px; color: #888; font-size: 12px;">{formatTimestamp(packet.timestamp)}</div>
                <div style="width: 80px;">
                  <span 
                    style={`display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #1a1a1a; background-color: ${protocolColors[packet.protocol] || protocolColors.Other};`}
                  >
                    {packet.protocol}
                  </span>
                </div>
                <div style="flex: 1; color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{packet.source.ip}:{packet.source.port}</div>
                <div style="flex: 1; color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{packet.destination.ip}:{packet.destination.port}</div>
                <div style="width: 80px; text-align: right; color: #74b9ff;">{packet.size} B</div>
                <div style="width: 100px; text-align: center;">
                  <span style={`display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; ${packet.direction === 'inbound' ? 'background-color: rgba(116, 185, 255, 0.2); color: #74b9ff;' : 'background-color: rgba(255, 107, 157, 0.2); color: #ff6b9d;'}`}>
                    {packet.direction === 'inbound' ? '↓' : '↑'} {packet.direction}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={selectedPacket()}>
        <div style="background: #2a2a2a; border-top: 2px solid #ff6b9d; padding: 20px; flex-shrink: 0;">
          <h4 style="margin: 0 0 16px 0; color: #ff6b9d; font-size: 16px;">Packet Details</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;">
            <div style="display: flex; gap: 12px;">
              <span style="font-weight: 600; color: #888; min-width: 100px;">ID:</span>
              <span style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedPacket()!.id}</span>
            </div>
            <div style="display: flex; gap: 12px;">
              <span style="font-weight: 600; color: #888; min-width: 100px;">Timestamp:</span>
              <span style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{new Date(selectedPacket()!.timestamp).toLocaleString()}</span>
            </div>
            <Show when={selectedPacket()!.flags}>
              <div style="display: flex; gap: 12px;">
                <span style="font-weight: 600; color: #888; min-width: 100px;">Flags:</span>
                <span style="color: #e74c3c; font-weight: 600; font-family: 'JetBrains Mono', monospace;">{selectedPacket()!.flags!.join(', ')}</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default NetworkTraffic;