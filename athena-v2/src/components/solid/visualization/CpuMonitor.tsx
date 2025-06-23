import { createSignal, onCleanup, onMount, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';

interface CpuInfo {
  usage: number;
  cores: CoreInfo[];
  frequency: number;
}

interface CoreInfo {
  id: number;
  usage: number;
  frequency: number;
}

export default function CpuMonitor() {
  const [cpuData, setCpuData] = createSignal<CpuInfo | null>(null);
  const [history, setHistory] = createSignal<number[]>([]);
  const [error, setError] = createSignal<string>('');
  
  let intervalId: number;
  const MAX_HISTORY_POINTS = 60;

  const updateCpuInfo = async () => {
    try {
      const data = await invoke<CpuInfo>('get_cpu_info');
      setCpuData(data);
      
      // Update history for graph
      setHistory(prev => {
        const newHistory = [...prev, data.usage];
        if (newHistory.length > MAX_HISTORY_POINTS) {
          newHistory.shift();
        }
        return newHistory;
      });
      
      setError('');
    } catch (err) {
      setError(`Failed to get CPU info: ${err}`);
    }
  };

  onMount(() => {
    updateCpuInfo();
    intervalId = window.setInterval(updateCpuInfo, 1000);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const formatFrequency = (freq: number) => {
    if (freq > 1000) {
      return `${(freq / 1000).toFixed(2)} GHz`;
    }
    return `${freq} MHz`;
  };

  const getUsageColor = (usage: number) => {
    if (usage < 30) return '#4ade80';
    if (usage < 60) return '#fbbf24';
    if (usage < 80) return '#fb923c';
    return '#ef4444';
  };

  const renderGraph = () => {
    const points = history();
    if (points.length < 2) return null;

    const width = 400;
    const height = 100;
    const step = width / (MAX_HISTORY_POINTS - 1);
    
    const pathData = points
      .map((usage, i) => {
        const x = i * step;
        const y = height - (usage / 100) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} class="cpu-graph">
        <defs>
          <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#ff6b9d;stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#ff6b9d;stop-opacity:0.1" />
          </linearGradient>
        </defs>
        <path
          d={pathData}
          fill="none"
          stroke="#ff6b9d"
          stroke-width="2"
        />
        <path
          d={`${pathData} L ${(points.length - 1) * step} ${height} L 0 ${height} Z`}
          fill="url(#cpuGradient)"
        />
      </svg>
    );
  };

  return (
    <AnalysisPanel title="CPU Monitor" icon="💻">
      <div class="content-panel">
      
      {error() && (
        <div class="error-message">{error()}</div>
      )}
      
        {cpuData() && (
          <>
            <div class="analysis-grid" style="margin-bottom: 20px;">
              <StatCard
                label="CPU Usage"
                value={`${cpuData()!.usage.toFixed(1)}%`}
              />
              <StatCard
                label="Frequency"
                value={formatFrequency(cpuData()!.frequency)}
              />
            </div>

            <div class="panel" style="margin-bottom: 20px;">
              <div class="panel-header">
                <h4>Usage History (60s)</h4>
              </div>
              <div style="padding: 20px; display: flex; justify-content: center;">
                {renderGraph()}
              </div>
            </div>

            <div class="panel">
              <div class="panel-header">
                <h4>CPU Cores</h4>
              </div>
              <div class="cores" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; padding: 20px;">
                <For each={cpuData()!.cores}>
                  {(core) => (
                    <div class="core-info" style="background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #444;">
                      <div class="core-label" style="color: var(--barbie-pink); font-weight: 600; margin-bottom: 8px;">Core {core.id}</div>
                      <div class="core-usage" style="position: relative;">
                        <div style="background: #1a1a1a; height: 20px; border-radius: 10px; overflow: hidden;">
                          <div 
                            class="core-bar"
                            style={{
                              width: `${core.usage}%`,
                              height: '100%',
                              background: getUsageColor(core.usage),
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                        <span style="position: absolute; right: 5px; top: 0; line-height: 20px; font-size: 12px; color: #e0e0e0;">{core.usage.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </>
        )}
      </div>
    </AnalysisPanel>
  );
}