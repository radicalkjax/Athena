import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { memoryManager, MemoryManager } from '../../../services/memoryManager';
import { logger } from '../../../services/loggingService';
import './MemoryMonitor.css';

const MemoryMonitor: Component = () => {
  const [stats, setStats] = createSignal(memoryManager.getStats());
  const [allocations, setAllocations] = createSignal<any[]>([]);
  const [showDetails, setShowDetails] = createSignal(false);
  
  let intervalId: number;
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Update stats every second
    intervalId = window.setInterval(() => {
      const newStats = memoryManager.getStats();
      setStats(newStats);
      
      // Convert Map to array for display
      const allocationArray = Array.from(newStats.allocations.values())
        .sort((a, b) => b.size - a.size);
      setAllocations(allocationArray);
    }, 1000);

    // Subscribe to pressure changes
    unsubscribe = memoryManager.onPressureChange((pressure) => {
      logger.debug('Memory pressure changed:', pressure);
    });
  });

  onCleanup(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (unsubscribe) {
      unsubscribe();
    }
  });

  const getUsagePercentage = () => {
    const s = stats();
    return s.totalLimit > 0 ? (s.totalAllocated / s.totalLimit) * 100 : 0;
  };

  const getPressureColor = (pressure: string) => {
    switch (pressure) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6666';
      case 'medium': return '#ffaa66';
      case 'low': return '#66ff66';
      default: return '#ffffff';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wasm': return '🚀';
      case 'file': return '📁';
      case 'analysis': return '🔍';
      case 'cache': return '💾';
      default: return '📦';
    }
  };

  const formatAge = (timestamp: number) => {
    const age = Date.now() - timestamp;
    if (age < 60000) return `${Math.floor(age / 1000)}s`;
    if (age < 3600000) return `${Math.floor(age / 60000)}m`;
    return `${Math.floor(age / 3600000)}h`;
  };

  const clearCache = () => {
    const freed = memoryManager.clearType('cache');
    logger.info(`Cleared ${MemoryManager.formatBytes(freed)} of cache`);
  };

  const clearFileAllocations = () => {
    const freed = memoryManager.clearType('file');
    logger.info(`Cleared ${MemoryManager.formatBytes(freed)} of file allocations`);
  };

  return (
    <div class="memory-monitor">
      <div class="memory-header">
        <h3>Memory Management</h3>
        <div class="memory-actions">
          <button 
            class="btn-small"
            onClick={() => setShowDetails(!showDetails())}
          >
            {showDetails() ? 'Hide' : 'Show'} Details
          </button>
        </div>
      </div>

      <div class="memory-overview">
        <div class="memory-gauge">
          <div class="gauge-info">
            <span class="gauge-label">Memory Usage</span>
            <span 
              class="gauge-value"
              style={{ color: getPressureColor(stats().pressure) }}
            >
              {getUsagePercentage().toFixed(1)}%
            </span>
          </div>
          <div class="gauge-bar">
            <div 
              class="gauge-fill"
              style={{
                width: `${getUsagePercentage()}%`,
                'background-color': getPressureColor(stats().pressure),
              }}
            />
          </div>
          <div class="gauge-details">
            <span>{MemoryManager.formatBytes(stats().totalAllocated)}</span>
            <span>/</span>
            <span>{MemoryManager.formatBytes(stats().totalLimit)}</span>
          </div>
        </div>

        <div class="pressure-indicator">
          <span class="pressure-label">Pressure:</span>
          <span 
            class="pressure-value"
            style={{ color: getPressureColor(stats().pressure) }}
          >
            {stats().pressure.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="allocation-summary">
        <h4>Allocations by Type</h4>
        <div class="type-grid">
          {['wasm', 'file', 'analysis', 'cache'].map(type => {
            const typeAllocations = allocations().filter(a => a.type === type);
            const totalSize = typeAllocations.reduce((sum, a) => sum + a.size, 0);
            
            return (
              <div class="type-card">
                <div class="type-header">
                  <span class="type-icon">{getTypeIcon(type)}</span>
                  <span class="type-name">{type.toUpperCase()}</span>
                </div>
                <div class="type-stats">
                  <div class="type-count">{typeAllocations.length} items</div>
                  <div class="type-size">{MemoryManager.formatBytes(totalSize)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Show when={showDetails()}>
        <div class="allocation-details">
          <div class="details-header">
            <h4>Allocation Details</h4>
            <div class="detail-actions">
              <button class="btn-small btn-warning" onClick={clearCache}>
                Clear Cache
              </button>
              <button class="btn-small btn-danger" onClick={clearFileAllocations}>
                Clear Files
              </button>
            </div>
          </div>
          
          <div class="allocations-list">
            <For each={allocations()}>
              {(allocation) => (
                <div class="allocation-item">
                  <div class="allocation-info">
                    <div class="allocation-id">
                      <span class="allocation-type-icon">{getTypeIcon(allocation.type)}</span>
                      <span class="allocation-name">{allocation.id}</span>
                    </div>
                    <Show when={allocation.description}>
                      <div class="allocation-desc">{allocation.description}</div>
                    </Show>
                  </div>
                  <div class="allocation-meta">
                    <span class="allocation-size">
                      {MemoryManager.formatBytes(allocation.size)}
                    </span>
                    <span class="allocation-age">
                      {formatAge(allocation.timestamp)}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="memory-tips">
        <h4>Memory Status</h4>
        <ul>
          {stats().pressure === 'critical' && (
            <li class="tip-critical">
              ⚠️ Critical memory pressure! Consider clearing cache or closing unused files.
            </li>
          )}
          {stats().pressure === 'high' && (
            <li class="tip-warning">
              ⚠️ High memory usage. Performance may be affected.
            </li>
          )}
          {allocations().filter(a => a.type === 'cache').length > 10 && (
            <li class="tip-info">
              💡 Cache has many items. Consider clearing old entries.
            </li>
          )}
          {stats().pressure === 'low' && (
            <li class="tip-success">
              ✅ Memory usage is healthy.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default MemoryMonitor;