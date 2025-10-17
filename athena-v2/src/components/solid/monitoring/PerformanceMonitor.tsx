import { Component, createSignal, onMount, onCleanup, For } from 'solid-js';
import { performanceMonitor } from '../../../services/performanceMonitor';
import './PerformanceMonitor.css';

interface MetricDisplay {
  name: string;
  value: number;
  unit: string;
  average: number;
  trend: 'up' | 'down' | 'stable';
}

const PerformanceMonitor: Component = () => {
  const [metrics, setMetrics] = createSignal<MetricDisplay[]>([]);
  const [fps, setFps] = createSignal(60);
  const [memoryUsage, setMemoryUsage] = createSignal({
    used: 0,
    total: 0,
    percentage: 0,
  });
  const [isMonitoring, setIsMonitoring] = createSignal(true);
  
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Start monitoring
    performanceMonitor.startMonitoring(1000);
    
    // Subscribe to updates
    unsubscribe = performanceMonitor.subscribe((snapshot) => {
      // Update FPS
      const fpsMetric = snapshot.metrics.find(m => m.name === 'FPS');
      if (fpsMetric) {
        setFps(Math.round(fpsMetric.value));
      }

      // Update memory usage
      if (snapshot.memoryUsage.heapTotal > 0) {
        const percentage = (snapshot.memoryUsage.heapUsed / snapshot.memoryUsage.heapTotal) * 100;
        setMemoryUsage({
          used: snapshot.memoryUsage.heapUsed,
          total: snapshot.memoryUsage.heapTotal,
          percentage: Math.round(percentage),
        });
      }

      // Update other metrics
      const displayMetrics: MetricDisplay[] = [];
      
      // Add custom metrics
      const wasmMetrics = performanceMonitor.getMetrics('wasm_execution');
      if (wasmMetrics.length > 0) {
        const latest = wasmMetrics[wasmMetrics.length - 1];
        if (latest) {
          const average = performanceMonitor.getAverageMetric('wasm_execution');
          displayMetrics.push({
            name: 'WASM Execution',
            value: Math.round(latest.value),
            unit: 'ms',
            average: Math.round(average),
            trend: latest.value > average ? 'up' : latest.value < average ? 'down' : 'stable',
          });
        }
      }

      // Add file processing metrics
      const fileMetrics = performanceMonitor.getMetrics('file_processing');
      if (fileMetrics.length > 0) {
        const latest = fileMetrics[fileMetrics.length - 1];
        if (latest) {
          const average = performanceMonitor.getAverageMetric('file_processing');
          displayMetrics.push({
            name: 'File Processing',
            value: Math.round(latest.value),
            unit: 'ms',
            average: Math.round(average),
            trend: latest.value > average ? 'up' : latest.value < average ? 'down' : 'stable',
          });
        }
      }

      setMetrics(displayMetrics);
    });
  });

  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    performanceMonitor.stopMonitoring();
  });

  const toggleMonitoring = () => {
    if (isMonitoring()) {
      performanceMonitor.stopMonitoring();
    } else {
      performanceMonitor.startMonitoring(1000);
    }
    setIsMonitoring(!isMonitoring());
  };

  const getFpsColor = (fps: number): string => {
    if (fps >= 50) return '#66ff66';
    if (fps >= 30) return '#ffaa66';
    return '#ff6666';
  };

  const getMemoryColor = (percentage: number): string => {
    if (percentage <= 50) return '#66ff66';
    if (percentage <= 75) return '#ffaa66';
    return '#ff6666';
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div class="performance-monitor">
      <div class="monitor-header">
        <h3>Performance Monitor</h3>
        <button
          class={`monitor-toggle ${isMonitoring() ? 'active' : ''}`}
          onClick={toggleMonitoring}
        >
          {isMonitoring() ? 'Monitoring' : 'Paused'}
        </button>
      </div>

      <div class="performance-grid">
        {/* FPS Monitor */}
        <div class="metric-card fps-card">
          <div class="metric-header">
            <span class="metric-title">Frame Rate</span>
            <span class="metric-icon">🎯</span>
          </div>
          <div class="metric-value">
            <span 
              class="fps-value"
              style={{ color: getFpsColor(fps()) }}
            >
              {fps()}
            </span>
            <span class="metric-unit">FPS</span>
          </div>
          <div class="fps-bar">
            <div 
              class="fps-fill"
              style={{
                width: `${(fps() / 60) * 100}%`,
                'background-color': getFpsColor(fps()),
              }}
            />
          </div>
        </div>

        {/* Memory Monitor */}
        <div class="metric-card memory-card">
          <div class="metric-header">
            <span class="metric-title">Memory Usage</span>
            <span class="metric-icon">💾</span>
          </div>
          <div class="metric-value">
            <span 
              class="memory-value"
              style={{ color: getMemoryColor(memoryUsage().percentage) }}
            >
              {memoryUsage().percentage}
            </span>
            <span class="metric-unit">%</span>
          </div>
          <div class="memory-details">
            <span>{formatBytes(memoryUsage().used)}</span>
            <span>/</span>
            <span>{formatBytes(memoryUsage().total)}</span>
          </div>
          <div class="memory-bar">
            <div 
              class="memory-fill"
              style={{
                width: `${memoryUsage().percentage}%`,
                'background-color': getMemoryColor(memoryUsage().percentage),
              }}
            />
          </div>
        </div>

        {/* Custom Metrics */}
        <For each={metrics()}>
          {(metric) => (
            <div class="metric-card custom-metric">
              <div class="metric-header">
                <span class="metric-title">{metric.name}</span>
                <span class={`trend-icon trend-${metric.trend}`}>
                  {getTrendIcon(metric.trend)}
                </span>
              </div>
              <div class="metric-value">
                <span class="primary-value">{metric.value}</span>
                <span class="metric-unit">{metric.unit}</span>
              </div>
              <div class="metric-average">
                <span>Avg: {metric.average} {metric.unit}</span>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="performance-tips">
        <h4>Performance Tips</h4>
        <ul>
          {fps() < 30 && <li>⚠️ Low FPS detected. Consider reducing visual effects.</li>}
          {memoryUsage().percentage > 80 && <li>⚠️ High memory usage. Consider clearing unused data.</li>}
          {metrics().some(m => m.name === 'WASM Execution' && m.value > 1000) && 
            <li>⚠️ Slow WASM execution. Check module optimization.</li>
          }
          {fps() >= 50 && memoryUsage().percentage < 60 && 
            <li>✅ System performance is optimal.</li>
          }
        </ul>
      </div>
    </div>
  );
};

export default PerformanceMonitor;