import { createSignal, Show } from 'solid-js';
import CpuMonitor from '../visualization/CpuMonitor';
import MemoryMonitor from '../visualization/MemoryMonitor';
import ProcessViewer from '../visualization/ProcessViewer';
import { invoke } from '@tauri-apps/api/core';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';

interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  used_space: number;
  usage_percentage: number;
}

interface NetworkInfo {
  interface: string;
  received: number;
  transmitted: number;
  packets_received: number;
  packets_transmitted: number;
}

export default function SystemMonitor() {
  const [activeTab, setActiveTab] = createSignal<'overview' | 'cpu' | 'memory' | 'processes' | 'disk' | 'network'>('overview');
  const [diskInfo, setDiskInfo] = createSignal<DiskInfo[]>([]);
  const [networkInfo, setNetworkInfo] = createSignal<NetworkInfo[]>([]);
  const [systemUptime, setSystemUptime] = createSignal<number>(0);

  const updateDiskInfo = async () => {
    try {
      const data = await invoke<DiskInfo[]>('get_disk_info');
      setDiskInfo(data);
    } catch (err) {
      console.error('Failed to get disk info:', err);
    }
  };

  const updateNetworkInfo = async () => {
    try {
      const data = await invoke<NetworkInfo[]>('get_network_info');
      setNetworkInfo(data);
    } catch (err) {
      console.error('Failed to get network info:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb > 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Load disk and network info when needed
  const loadAdditionalInfo = () => {
    if (activeTab() === 'disk' || activeTab() === 'overview') {
      updateDiskInfo();
    }
    if (activeTab() === 'network' || activeTab() === 'overview') {
      updateNetworkInfo();
    }
  };

  return (
    <div class="content-panel">
      <div class="panel-header">
        <h3><span style="color: var(--barbie-pink)">📊</span> System Monitor</h3>
        <div class="monitor-tabs">
          <button 
            class={activeTab() === 'overview' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setActiveTab('overview');
              loadAdditionalInfo();
            }}
          >
            Overview
          </button>
          <button 
            class={activeTab() === 'cpu' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('cpu')}
          >
            CPU
          </button>
          <button 
            class={activeTab() === 'memory' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('memory')}
          >
            Memory
          </button>
          <button 
            class={activeTab() === 'processes' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('processes')}
          >
            Processes
          </button>
          <button 
            class={activeTab() === 'disk' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setActiveTab('disk');
              updateDiskInfo();
            }}
          >
            Disk
          </button>
          <button 
            class={activeTab() === 'network' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setActiveTab('network');
              updateNetworkInfo();
            }}
          >
            Network
          </button>
        </div>
      </div>

      <div class="monitor-content">
        <Show when={activeTab() === 'overview'}>
          <div class="analysis-grid">
            <AnalysisPanel title="CPU Usage" icon="🖥️">
              <CpuMonitor />
            </AnalysisPanel>
            <AnalysisPanel title="Memory Usage" icon="🧠">
              <MemoryMonitor />
            </AnalysisPanel>
            <AnalysisPanel title="Disk Usage" icon="💾">
              <div class="disk-list">
                {diskInfo().map(disk => (
                  <div class="disk-item">
                    <div class="disk-name">{disk.name} ({disk.mount_point})</div>
                    <div class="disk-usage">
                      <div class="usage-bar">
                        <div 
                          class="usage-fill"
                          style={{
                            width: `${disk.usage_percentage}%`,
                            background: disk.usage_percentage > 80 ? '#ef4444' : 
                                       disk.usage_percentage > 60 ? '#fbbf24' : '#4ade80'
                          }}
                        />
                      </div>
                      <span class="usage-text">
                        {formatBytes(disk.used_space)} / {formatBytes(disk.total_space)} 
                        ({disk.usage_percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </AnalysisPanel>
            <AnalysisPanel title="Network Interfaces" icon="📡">
              <div class="network-list">
                {networkInfo().map(net => (
                  <div class="network-item">
                    <div class="network-name">{net.interface}</div>
                    <div class="network-stats">
                      <div class="stat">
                        <span class="label">↓</span>
                        <span class="value">{formatBytes(net.received)}</span>
                      </div>
                      <div class="stat">
                        <span class="label">↑</span>
                        <span class="value">{formatBytes(net.transmitted)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AnalysisPanel>
          </div>
        </Show>

        <Show when={activeTab() === 'cpu'}>
          <AnalysisPanel title="CPU Monitor" icon="🖥️">
            <CpuMonitor />
          </AnalysisPanel>
        </Show>

        <Show when={activeTab() === 'memory'}>
          <AnalysisPanel title="Memory Monitor" icon="🧠">
            <MemoryMonitor />
          </AnalysisPanel>
        </Show>

        <Show when={activeTab() === 'processes'}>
          <AnalysisPanel title="Process Viewer" icon="⚙️">
            <ProcessViewer />
          </AnalysisPanel>
        </Show>

        <Show when={activeTab() === 'disk'}>
          <AnalysisPanel title="Disk Usage" icon="💾">
            <div class="analysis-grid">
              {diskInfo().map(disk => (
                <div class="disk-card">
                  <h4>{disk.name}</h4>
                  <div class="disk-mount">{disk.mount_point}</div>
                  <div class="disk-visual">
                    <svg width="150" height="150" class="disk-chart">
                      <circle
                        cx="75"
                        cy="75"
                        r="60"
                        fill="none"
                        stroke="#2a2a2a"
                        stroke-width="20"
                      />
                      <circle
                        cx="75"
                        cy="75"
                        r="60"
                        fill="none"
                        stroke={disk.usage_percentage > 80 ? '#ef4444' : 
                               disk.usage_percentage > 60 ? '#fbbf24' : '#4ade80'}
                        stroke-width="20"
                        stroke-dasharray={`${disk.usage_percentage * 3.77} 377`}
                        transform="rotate(-90 75 75)"
                      />
                      <text x="75" y="75" text-anchor="middle" dominant-baseline="middle" class="disk-percentage">
                        {disk.usage_percentage.toFixed(0)}%
                      </text>
                    </svg>
                  </div>
                  <div class="disk-details">
                    <div class="detail">
                      <span>Used:</span>
                      <span>{formatBytes(disk.used_space)}</span>
                    </div>
                    <div class="detail">
                      <span>Free:</span>
                      <span>{formatBytes(disk.available_space)}</span>
                    </div>
                    <div class="detail">
                      <span>Total:</span>
                      <span>{formatBytes(disk.total_space)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnalysisPanel>
        </Show>

        <Show when={activeTab() === 'network'}>
          <AnalysisPanel title="Network Interfaces" icon="📡">
            <div class="analysis-grid">
              {networkInfo().map(net => (
                <div class="network-card">
                  <h4>{net.interface}</h4>
                  <div class="network-stats-grid">
                    <div class="network-stat">
                      <div class="stat-icon">↓</div>
                      <div class="stat-label">Received</div>
                      <div class="stat-value">{formatBytes(net.received)}</div>
                      <div class="stat-packets">{net.packets_received.toLocaleString()} packets</div>
                    </div>
                    <div class="network-stat">
                      <div class="stat-icon">↑</div>
                      <div class="stat-label">Transmitted</div>
                      <div class="stat-value">{formatBytes(net.transmitted)}</div>
                      <div class="stat-packets">{net.packets_transmitted.toLocaleString()} packets</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnalysisPanel>
        </Show>
      </div>
    </div>
  );
}