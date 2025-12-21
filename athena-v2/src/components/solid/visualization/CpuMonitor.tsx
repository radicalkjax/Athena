import { createSignal, onCleanup, For, createEffect } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import { useRealtimeData, useAnimatedValue } from '../../../services/realtimeService';

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
  const cpuData = useRealtimeData<CpuInfo | null>('cpu', null);
  const [history, setHistory] = createSignal<number[]>([]);
  
  const animatedUsage = useAnimatedValue(() => cpuData()?.usage || 0, 500);
  const animatedFrequency = useAnimatedValue(() => cpuData()?.frequency || 0, 500);
  
  const MAX_HISTORY_POINTS = 60;

  // Update history whenever cpuData changes
  createEffect(() => {
    const data = cpuData();
    if (data) {
      setHistory(prev => {
        const newHistory = [...prev, data.usage];
        if (newHistory.length > MAX_HISTORY_POINTS) {
          newHistory.shift();
        }
        return newHistory;
      });
    }
  });

  onCleanup(() => {
    // Cleanup handled by realtimeService
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
          style="transition: d 0.3s ease-out;"
        />
        <path
          d={`${pathData} L ${(points.length - 1) * step} ${height} L 0 ${height} Z`}
          style="transition: d 0.3s ease-out;"
          fill="url(#cpuGradient)"
        />
      </svg>
    );
  };

  return (
    <AnalysisPanel title="CPU Monitor" icon="💻">
      <div class="content-panel">
      
        {cpuData() && (
          <>
            <div class="analysis-grid" style="margin-bottom: 20px;">
              <StatCard
                label="CPU Usage"
                value={`${animatedUsage().toFixed(1)}%`}
              />
              <StatCard
                label="Frequency"
                value={formatFrequency(animatedFrequency())}
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
                              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                              'box-shadow': `0 0 10px ${getUsageColor(core.usage)}40`
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