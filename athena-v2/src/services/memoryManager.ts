interface MemoryAllocation {
  id: string;
  size: number;
  type: 'wasm' | 'file' | 'analysis' | 'cache';
  timestamp: number;
  description?: string;
}

interface MemoryStats {
  totalAllocated: number;
  totalLimit: number;
  allocations: Map<string, MemoryAllocation>;
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

class MemoryManager {
  private static instance: MemoryManager;
  
  private allocations = new Map<string, MemoryAllocation>();
  private totalLimit = 500 * 1024 * 1024; // 500MB default limit
  private warningThreshold = 0.7; // 70% usage warning
  private criticalThreshold = 0.9; // 90% usage critical
  private cleanupCallbacks = new Map<string, () => void>();
  private pressureCallbacks = new Set<(pressure: MemoryStats['pressure']) => void>();

  private constructor() {
    // Start monitoring memory pressure
    this.startMemoryMonitoring();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // Allocate memory
  allocate(
    id: string,
    size: number,
    type: MemoryAllocation['type'],
    description?: string,
    cleanupCallback?: () => void
  ): boolean {
    const totalAllocated = this.getTotalAllocated();
    
    // Check if allocation would exceed limit
    if (totalAllocated + size > this.totalLimit) {
      // Try to free up memory
      const freed = this.runGarbageCollection(size);
      if (totalAllocated - freed + size > this.totalLimit) {
        console.error(`Memory allocation failed: Requested ${size} bytes would exceed limit`);
        return false;
      }
    }

    // Create allocation record
    const allocation: MemoryAllocation = {
      id,
      size,
      type,
      timestamp: Date.now(),
      description,
    };

    this.allocations.set(id, allocation);
    
    if (cleanupCallback) {
      this.cleanupCallbacks.set(id, cleanupCallback);
    }

    // Check memory pressure
    this.checkMemoryPressure();

    return true;
  }

  // Deallocate memory
  deallocate(id: string): boolean {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      return false;
    }

    // Run cleanup callback if exists
    const cleanup = this.cleanupCallbacks.get(id);
    if (cleanup) {
      try {
        cleanup();
      } catch (error) {
        console.error(`Error during cleanup for ${id}:`, error);
      }
      this.cleanupCallbacks.delete(id);
    }

    this.allocations.delete(id);
    this.checkMemoryPressure();
    
    return true;
  }

  // Get total allocated memory
  getTotalAllocated(): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      total += allocation.size;
    }
    return total;
  }

  // Get memory statistics
  getStats(): MemoryStats {
    const totalAllocated = this.getTotalAllocated();
    const pressure = this.calculatePressure(totalAllocated);

    return {
      totalAllocated,
      totalLimit: this.totalLimit,
      allocations: new Map(this.allocations),
      pressure,
    };
  }

  // Calculate memory pressure
  private calculatePressure(totalAllocated: number): MemoryStats['pressure'] {
    const usage = totalAllocated / this.totalLimit;
    
    if (usage >= this.criticalThreshold) return 'critical';
    if (usage >= this.warningThreshold) return 'high';
    if (usage >= 0.5) return 'medium';
    return 'low';
  }

  // Run garbage collection
  private runGarbageCollection(requiredSize: number): number {
    let freedSize = 0;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Sort allocations by age (oldest first)
    const sortedAllocations = Array.from(this.allocations.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [id, allocation] of sortedAllocations) {
      // Skip critical allocations
      if (allocation.type === 'wasm' || allocation.type === 'analysis') {
        continue;
      }

      // Free old cache allocations
      if (allocation.type === 'cache' && (now - allocation.timestamp) > maxAge) {
        if (this.deallocate(id)) {
          freedSize += allocation.size;
          console.log(`GC: Freed ${allocation.size} bytes from ${id}`);
        }
      }

      // Stop if we've freed enough
      if (freedSize >= requiredSize) {
        break;
      }
    }

    // If still not enough, free file allocations
    if (freedSize < requiredSize) {
      for (const [id, allocation] of sortedAllocations) {
        if (allocation.type === 'file' && (now - allocation.timestamp) > maxAge / 2) {
          if (this.deallocate(id)) {
            freedSize += allocation.size;
            console.log(`GC: Freed ${allocation.size} bytes from ${id}`);
          }
        }

        if (freedSize >= requiredSize) {
          break;
        }
      }
    }

    return freedSize;
  }

  // Check memory pressure and notify listeners
  private checkMemoryPressure(): void {
    const stats = this.getStats();
    
    // Notify pressure callbacks
    for (const callback of this.pressureCallbacks) {
      try {
        callback(stats.pressure);
      } catch (error) {
        console.error('Error in pressure callback:', error);
      }
    }
  }

  // Subscribe to memory pressure changes
  onPressureChange(callback: (pressure: MemoryStats['pressure']) => void): () => void {
    this.pressureCallbacks.add(callback);
    return () => this.pressureCallbacks.delete(callback);
  }

  // Start memory monitoring
  private startMemoryMonitoring(): void {
    // Check memory pressure every 5 seconds
    setInterval(() => {
      this.checkMemoryPressure();
      
      // Run GC if pressure is high
      const stats = this.getStats();
      if (stats.pressure === 'critical' || stats.pressure === 'high') {
        const targetFree = this.totalLimit * 0.3; // Try to free 30%
        this.runGarbageCollection(targetFree);
      }
    }, 5000);
  }

  // Set memory limit
  setMemoryLimit(limitMB: number): void {
    this.totalLimit = limitMB * 1024 * 1024;
    this.checkMemoryPressure();
  }

  // Get allocation by type
  getAllocationsByType(type: MemoryAllocation['type']): MemoryAllocation[] {
    const allocations: MemoryAllocation[] = [];
    for (const allocation of this.allocations.values()) {
      if (allocation.type === type) {
        allocations.push(allocation);
      }
    }
    return allocations;
  }

  // Clear all allocations of a specific type
  clearType(type: MemoryAllocation['type']): number {
    let freedSize = 0;
    const toDelete: string[] = [];

    for (const [id, allocation] of this.allocations) {
      if (allocation.type === type) {
        toDelete.push(id);
        freedSize += allocation.size;
      }
    }

    for (const id of toDelete) {
      this.deallocate(id);
    }

    return freedSize;
  }

  // Format bytes for display
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

export const memoryManager = MemoryManager.getInstance();
export { MemoryManager };