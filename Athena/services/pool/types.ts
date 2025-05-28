/**
 * Types for resource pooling system
 */

export interface PooledResource<T> {
  id: string;
  resource: T;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
  usageCount: number;
  provider: string;
}

export interface ResourcePoolConfig {
  minSize: number;
  maxSize: number;
  acquireTimeout: number;
  idleTimeout: number;
  evictionInterval: number;
  createRetries: number;
  validateOnAcquire: boolean;
}

export interface ResourcePoolStats {
  size: number;
  available: number;
  inUse: number;
  totalCreated: number;
  totalDestroyed: number;
  totalAcquisitions: number;
  totalReleases: number;
  averageWaitTime: number;
  peakSize: number;
}

export interface ResourceFactory<T> {
  create(): Promise<T>;
  validate(resource: T): Promise<boolean>;
  destroy(resource: T): Promise<void>;
}

export interface ResourcePool<T> {
  acquire(): Promise<PooledResource<T>>;
  release(resourceId: string): void;
  destroy(resourceId: string): void;
  getStats(): ResourcePoolStats;
  clear(): Promise<void>;
  resize(minSize: number, maxSize: number): void;
}