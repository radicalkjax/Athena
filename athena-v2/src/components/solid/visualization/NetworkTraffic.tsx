import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../services/loggingService';
import './NetworkTraffic.css';

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
  const [useRealData, setUseRealData] = createSignal(true);
  const [captureId, setCaptureId] = createSignal<string | null>(null);
  const [captureError, setCaptureError] = createSignal<string | null>(null);
  const [hasPermission, setHasPermission] = createSignal<boolean | null>(null);
  const [canRequestPermission, setCanRequestPermission] = createSignal(false);
  const [isRequestingPermission, setIsRequestingPermission] = createSignal(false);

  let intervalId: number | null = null;
  let packetsInLastSecond: NetworkPacket[] = [];
  let packetEventUnlisten: UnlistenFn | null = null;

  // Check capture permissions on component mount
  const checkPermissions = async () => {
    try {
      const status = await invoke<{
        has_permission: boolean;
        platform: string;
        message: string;
        can_request_elevation: boolean;
      }>('check_capture_permissions');

      setHasPermission(status.has_permission);
      setCanRequestPermission(status.can_request_elevation);

      if (!status.has_permission) {
        setCaptureError(status.message);
      }
    } catch (error) {
      logger.error('Failed to check capture permissions', error);
      setHasPermission(false);
    }
  };

  // Request elevated permissions for packet capture
  const requestPermissions = async () => {
    setIsRequestingPermission(true);
    setCaptureError(null);

    try {
      const result = await invoke<string>('request_capture_permissions');
      logger.info('Permission request result:', result);

      // Re-check permissions after granting
      await checkPermissions();

      if (hasPermission()) {
        setCaptureError(null);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setCaptureError(errorMsg);
      logger.error('Failed to request permissions', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const protocolColors: Record<string, string> = {
    TCP: '#ff6b9d',
    UDP: '#74b9ff',
    HTTP: '#feca57',
    HTTPS: '#48dbfb',
    DNS: '#ff9ff3',
    Other: '#dfe6e9'
  };

  // Mock packet generation removed - will only use real network data

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

  const startCapture = async () => {
    setCaptureError(null);

    if (useRealData()) {
      try {
        // First, set up the event listener
        packetEventUnlisten = await listen<NetworkPacket>('packet-captured', (event) => {
          const packet = event.payload;

          packetsInLastSecond.push(packet);

          setPackets(prev => {
            const updated = [...prev, packet];
            // Keep only last 1000 packets for performance
            return updated.slice(-1000);
          });

          updateStats();
        });

        // Then start the actual packet capture on the backend
        const result = await invoke<string>('start_packet_capture', { interface: null });
        logger.info('Packet capture started:', result);

        // Extract capture ID from result (format: "Capture started on interface: X (ID: uuid)")
        const idMatch = result.match(/ID: ([a-f0-9-]+)/);
        console.log('Start capture result:', result, 'ID match:', idMatch);
        if (idMatch && idMatch[1]) {
          setCaptureId(idMatch[1]);
          console.log('Capture ID set to:', idMatch[1]);
        } else {
          console.warn('Could not extract capture ID from result');
        }

        setIsCapturing(true);
      } catch (error) {
        logger.error('Failed to start packet capture', error);
        setCaptureError(error instanceof Error ? error.message : String(error));
        // Clean up listener if capture failed
        if (packetEventUnlisten) {
          packetEventUnlisten();
          packetEventUnlisten = null;
        }
      }
    } else {
      // No real-time data available
      setIsCapturing(true);
      logger.info('Real-time network data not available - mock mode');
    }
  };

  const stopCapture = async () => {
    console.log('stopCapture called, captureId:', captureId());
    setIsCapturing(false);
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (packetEventUnlisten) {
      packetEventUnlisten();
      packetEventUnlisten = null;
    }
    // Stop the backend capture
    const currentCaptureId = captureId();
    if (currentCaptureId) {
      try {
        console.log('Calling stop_packet_capture with ID:', currentCaptureId);
        const result = await invoke('stop_packet_capture', { captureId: currentCaptureId });
        console.log('Stop capture result:', result);
        logger.info('Packet capture stopped');
      } catch (error) {
        console.error('Failed to stop capture:', error);
        logger.error('Failed to stop packet capture', error);
      }
      setCaptureId(null);
    } else {
      console.warn('No capture ID available to stop');
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
        p.source_ip?.toLowerCase().includes(filterText) ||
        p.destination_ip?.toLowerCase().includes(filterText) ||
        p.protocol?.toLowerCase().includes(filterText)
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
    const time = date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
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
    // Real-time packet data is available via Tauri events when capture is active
    setUseRealData(true);
    // Check if we have packet capture permissions
    checkPermissions();
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
              style={`padding: 8px 16px; background: ${isCapturing() ? '#e74c3c' : '#ff6b9d'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;`}
              onClick={() => { isCapturing() ? stopCapture() : startCapture(); }}
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
            <Show when={captureError()}>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #e74c3c; font-size: 11px; padding: 4px 8px; background: rgba(231, 76, 60, 0.2); border-radius: 4px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title={captureError() || ''}>
                  ⚠ {captureError()?.split('.')[0]}
                </span>
                <Show when={canRequestPermission() && !hasPermission()}>
                  <button
                    style={`padding: 6px 12px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.3s ease; ${isRequestingPermission() ? 'opacity: 0.7; cursor: wait;' : ''}`}
                    onClick={requestPermissions}
                    disabled={isRequestingPermission()}
                  >
                    {isRequestingPermission() ? '⏳ Requesting...' : '🔓 Grant Access'}
                  </button>
                </Show>
              </div>
            </Show>
          </div>
          
          <div style="display: flex; gap: 24px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; color: #888;">Data Source:</span>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={useRealData()}
                  onChange={(e) => {
                    setUseRealData(e.currentTarget.checked);
                    if (isCapturing()) {
                      stopCapture();
                      startCapture();
                    }
                  }}
                  style="cursor: pointer;"
                />
                <span style={`font-size: 12px; font-weight: 600; color: ${useRealData() ? '#48dbfb' : '#feca57'};`}>
                  {useRealData() ? 'Live' : 'Mock'}
                </span>
              </label>
            </div>
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
                <div style="flex: 1; color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{packet.source_ip || '(no IP)'}:{packet.source_port ?? '-'}</div>
                <div style="flex: 1; color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{packet.destination_ip || '(no IP)'}:{packet.destination_port ?? '-'}</div>
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