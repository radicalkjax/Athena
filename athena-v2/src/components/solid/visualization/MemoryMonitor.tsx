import { createSignal, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface MemoryInfo {
  total: number;
  used: number;
  available: number;
  swap_total: number;
  swap_used: number;
  usage_percentage: number;
}

export default function MemoryMonitor() {
  const [memoryData, setMemoryData] = createSignal<MemoryInfo | null>(null);
  const [history, setHistory] = createSignal<number[]>([]);
  const [error, setError] = createSignal<string>('');
  
  let intervalId: number;
  const MAX_HISTORY_POINTS = 60;

  const updateMemoryInfo = async () => {
    try {
      const data = await invoke<MemoryInfo>('get_memory_info');
      setMemoryData(data);
      
      // Update history for graph
      setHistory(prev => {
        const newHistory = [...prev, data.usage_percentage];
        if (newHistory.length > MAX_HISTORY_POINTS) {
          newHistory.shift();
        }
        return newHistory;
      });
      
      setError('');
    } catch (err) {
      setError(`Failed to get memory info: ${err}`);
    }
  };

  onMount(() => {
    updateMemoryInfo();
    intervalId = window.setInterval(updateMemoryInfo, 1000);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb > 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return '#4ade80';
    if (percentage < 70) return '#fbbf24';
    if (percentage < 85) return '#fb923c';
    return '#ef4444';
  };

  const renderDonutChart = (percentage: number, label: string) => {
    const radius = 60;
    const strokeWidth = 12;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div class="donut-chart-container">
        <svg height={radius * 2} width={radius * 2} class="donut-chart">
          <circle
            stroke="#2a2a2a"
            fill="transparent"
            stroke-width={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={getUsageColor(percentage)}
            fill="transparent"
            stroke-width={strokeWidth}
            stroke-dasharray={`${circumference} ${circumference}`}
            style={{ "stroke-dashoffset": strokeDashoffset }}
            stroke-linecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
          <text
            x="50%"
            y="50%"
            text-anchor="middle"
            dominant-baseline="middle"
            class="donut-text"
          >
            <tspan x="50%" dy="-0.1em" font-size="24" font-weight="bold">
              {percentage.toFixed(0)}%
            </tspan>
            <tspan x="50%" dy="1.5em" font-size="12">
              {label}
            </tspan>
          </text>
        </svg>
      </div>
    );
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
      <svg width={width} height={height} class="memory-graph">
        <defs>
          <linearGradient id="memGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#c77dff;stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#c77dff;stop-opacity:0.1" />
          </linearGradient>
        </defs>
        <path
          d={pathData}
          fill="none"
          stroke="#c77dff"
          stroke-width="2"
        />
        <path
          d={`${pathData} L ${(points.length - 1) * step} ${height} L 0 ${height} Z`}
          fill="url(#memGradient)"
        />
      </svg>
    );
  };

  return (
    <div class="memory-monitor">
      <h3>Memory Monitor</h3>
      
      {error() && (
        <div class="error-message">{error()}</div>
      )}
      
      {memoryData() && (
        <div class="memory-stats">
          <div class="memory-overview">
            <div class="memory-charts">
              {renderDonutChart(memoryData()!.usage_percentage, 'RAM')}
              {memoryData()!.swap_total > 0 && renderDonutChart(
                (memoryData()!.swap_used / memoryData()!.swap_total) * 100,
                'Swap'
              )}
            </div>
            
            <div class="memory-details">
              <div class="memory-detail-row">
                <span class="label">Total RAM:</span>
                <span class="value">{formatBytes(memoryData()!.total)}</span>
              </div>
              <div class="memory-detail-row">
                <span class="label">Used RAM:</span>
                <span class="value" style={{ color: getUsageColor(memoryData()!.usage_percentage) }}>
                  {formatBytes(memoryData()!.used)}
                </span>
              </div>
              <div class="memory-detail-row">
                <span class="label">Available:</span>
                <span class="value">{formatBytes(memoryData()!.available)}</span>
              </div>
              {memoryData()!.swap_total > 0 && (
                <>
                  <div class="memory-detail-row">
                    <span class="label">Swap Total:</span>
                    <span class="value">{formatBytes(memoryData()!.swap_total)}</span>
                  </div>
                  <div class="memory-detail-row">
                    <span class="label">Swap Used:</span>
                    <span class="value">{formatBytes(memoryData()!.swap_used)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div class="memory-graph-container">
            <div class="graph-label">Memory Usage History (60s)</div>
            {renderGraph()}
          </div>

          <div class="memory-bar-visualization">
            <div class="memory-bar-label">Memory Usage Breakdown</div>
            <div class="memory-bar">
              <div 
                class="memory-used"
                style={{
                  width: `${memoryData()!.usage_percentage}%`,
                  background: `linear-gradient(90deg, #ff6b9d, #c77dff)`
                }}
              >
                <span class="bar-label">Used</span>
              </div>
              <div class="memory-available">
                <span class="bar-label">Available</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}