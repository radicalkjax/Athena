/**
 * Generic resource pool implementation
 */

import {
  ResourcePool,
  ResourcePoolConfig,
  ResourcePoolStats,
  ResourceFactory,
  PooledResource,
} from './types';
import { logger } from '@/shared/logging/logger';

const DEFAULT_CONFIG: ResourcePoolConfig = {
  minSize: 2,
  maxSize: 10,
  acquireTimeout: 5000,
  idleTimeout: 300000, // 5 minutes
  evictionInterval: 60000, // 1 minute
  createRetries: 3,
  validateOnAcquire: true,
};

export class GenericResourcePool<T> implements ResourcePool<T> {
  private config: ResourcePoolConfig;
  private factory: ResourceFactory<T>;
  private resources: Map<string, PooledResource<T>> = new Map();
  private waitingQueue: Array<{
    resolve: (resource: PooledResource<T>) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private stats: ResourcePoolStats;
  private evictionTimer: NodeJS.Timeout | null = null;
  private resourceIdCounter = 0;

  constructor(
    factory: ResourceFactory<T>,
    config: Partial<ResourcePoolConfig> = {}
  ) {
    this.factory = factory;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      size: 0,
      available: 0,
      inUse: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquisitions: 0,
      totalReleases: 0,
      averageWaitTime: 0,
      peakSize: 0,
    };

    // Initialize pool with minimum resources
    this.initialize();

    // Start eviction timer
    this.startEvictionTimer();
  }

  async acquire(): Promise<PooledResource<T>> {
    const startTime = Date.now();
    
    // Try to get an available resource
    const available = this.getAvailableResource();
    if (available) {
      await this.prepareResource(available);
      this.updateAcquisitionStats(Date.now() - startTime);
      return available;
    }

    // Try to create a new resource if under max size
    if (this.stats.size < this.config.maxSize) {
      try {
        const resource = await this.createResource();
        this.updateAcquisitionStats(Date.now() - startTime);
        return resource;
      } catch (error) {
        logger.error('Failed to create resource:', error);
      }
    }

    // Wait for a resource to become available
    return this.waitForResource(startTime);
  }

  release(resourceId: string): void {
    const pooledResource = this.resources.get(resourceId);
    if (!pooledResource) {
      logger.warn(`Attempted to release unknown resource: ${resourceId}`);
      return;
    }

    if (!pooledResource.inUse) {
      logger.warn(`Resource ${resourceId} is not in use`);
      return;
    }

    pooledResource.inUse = false;
    pooledResource.lastUsedAt = Date.now();
    this.stats.inUse--;
    this.stats.available++;
    this.stats.totalReleases++;

    // Check if anyone is waiting for a resource
    this.processWaitingQueue();
  }

  async destroy(resourceId: string): Promise<void> {
    const pooledResource = this.resources.get(resourceId);
    if (!pooledResource) {
      return;
    }

    try {
      await this.factory.destroy(pooledResource.resource);
    } catch (error) {
      logger.error(`Failed to destroy resource ${resourceId}:`, error);
    }

    this.resources.delete(resourceId);
    this.stats.size--;
    if (pooledResource.inUse) {
      this.stats.inUse--;
    } else {
      this.stats.available--;
    }
    this.stats.totalDestroyed++;

    // Try to maintain minimum size
    if (this.stats.size < this.config.minSize) {
      this.createResource().catch(error => {
        logger.error('Failed to maintain minimum pool size:', error);
      });
    }
  }

  getStats(): ResourcePoolStats {
    return { ...this.stats };
  }

  async clear(): Promise<void> {
    this.stopEvictionTimer();

    // Reject all waiting requests
    for (const waiting of this.waitingQueue) {
      waiting.reject(new Error('Pool is being cleared'));
    }
    this.waitingQueue = [];

    // Destroy all resources
    const destroyPromises: Promise<void>[] = [];
    for (const [id] of this.resources) {
      destroyPromises.push(this.destroy(id));
    }
    await Promise.all(destroyPromises);
  }

  resize(minSize: number, maxSize: number): void {
    this.config.minSize = minSize;
    this.config.maxSize = maxSize;

    // Adjust pool size if needed
    if (this.stats.size < minSize) {
      const createCount = minSize - this.stats.size;
      for (let i = 0; i < createCount; i++) {
        this.createResource().catch(error => {
          logger.error('Failed to create resource during resize:', error);
        });
      }
    }
  }

  // Private methods
  private async initialize(): Promise<void> {
    const createPromises: Promise<PooledResource<T>>[] = [];
    for (let i = 0; i < this.config.minSize; i++) {
      createPromises.push(this.createResource());
    }

    try {
      await Promise.all(createPromises);
    } catch (error) {
      logger.error('Failed to initialize resource pool:', error);
    }
  }

  private async createResource(): Promise<PooledResource<T>> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.config.createRetries; i++) {
      try {
        const resource = await this.factory.create();
        const id = `resource_${++this.resourceIdCounter}`;
        
        const pooledResource: PooledResource<T> = {
          id,
          resource,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          inUse: true,
          usageCount: 1,
          provider: 'generic',
        };

        this.resources.set(id, pooledResource);
        this.stats.size++;
        this.stats.inUse++;
        this.stats.totalCreated++;
        
        if (this.stats.size > this.stats.peakSize) {
          this.stats.peakSize = this.stats.size;
        }

        return pooledResource;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Resource creation attempt ${i + 1} failed:`, error);
      }
    }

    throw lastError || new Error('Failed to create resource');
  }

  private getAvailableResource(): PooledResource<T> | null {
    for (const resource of this.resources.values()) {
      if (!resource.inUse) {
        return resource;
      }
    }
    return null;
  }

  private async prepareResource(resource: PooledResource<T>): Promise<void> {
    // Validate if configured
    if (this.config.validateOnAcquire) {
      try {
        const isValid = await this.factory.validate(resource.resource);
        if (!isValid) {
          await this.destroy(resource.id);
          throw new Error('Resource validation failed');
        }
      } catch (error) {
        await this.destroy(resource.id);
        throw error;
      }
    }

    resource.inUse = true;
    resource.lastUsedAt = Date.now();
    resource.usageCount++;
    this.stats.inUse++;
    this.stats.available--;
    this.stats.totalAcquisitions++;
  }

  private waitForResource(startTime: number): Promise<PooledResource<T>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Resource acquisition timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve: (resource) => {
          clearTimeout(timeout);
          this.updateAcquisitionStats(Date.now() - startTime);
          resolve(resource);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: startTime,
      });
    });
  }

  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) return;

    const available = this.getAvailableResource();
    if (!available) return;

    const waiting = this.waitingQueue.shift();
    if (waiting) {
      this.prepareResource(available)
        .then(() => waiting.resolve(available))
        .catch(error => waiting.reject(error));
    }
  }

  private updateAcquisitionStats(waitTime: number): void {
    const totalWaitTime = this.stats.averageWaitTime * this.stats.totalAcquisitions;
    this.stats.averageWaitTime = (totalWaitTime + waitTime) / (this.stats.totalAcquisitions + 1);
  }

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.evictIdleResources();
    }, this.config.evictionInterval);
  }

  private stopEvictionTimer(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  private evictIdleResources(): void {
    const now = Date.now();
    const evictionCandidates: string[] = [];

    for (const [id, resource] of this.resources) {
      if (!resource.inUse && 
          now - resource.lastUsedAt > this.config.idleTimeout &&
          this.stats.size > this.config.minSize) {
        evictionCandidates.push(id);
      }
    }

    for (const id of evictionCandidates) {
      this.destroy(id).catch(error => {
        logger.error(`Failed to evict idle resource ${id}:`, error);
      });
    }
  }
}