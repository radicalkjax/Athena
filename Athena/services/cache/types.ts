/**
 * Cache system types for performance optimization
 */

import { DeobfuscationResult, VulnerabilityAnalysisResult } from '@/services/ai/types';

export type CacheableResult = DeobfuscationResult | VulnerabilityAnalysisResult;

export interface CacheEntry<T = CacheableResult> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
  size: number;
  provider?: string;
  analysisType: 'deobfuscate' | 'vulnerabilities';
  ttl?: number; // Time to live in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
  entryCount: number;
}

export interface CacheConfig {
  maxSize: number; // Max cache size in bytes
  ttl: number; // Time to live in milliseconds
  maxEntries: number; // Max number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export interface CacheStorage {
  get<T = CacheableResult>(key: string): Promise<CacheEntry<T> | null>;
  set<T = CacheableResult>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getKeys(): Promise<string[]>;
  getSize(): Promise<number>;
}

export interface CachePolicyOptions {
  // File-based caching
  includeFileHash: boolean;
  // Analysis type caching
  includeAnalysisType: boolean;
  // Provider-specific caching
  includeProvider: boolean;
  // Custom cache key generator
  keyGenerator?: (params: CacheKeyParams) => string;
}

export interface CacheKeyParams {
  fileHash: string;
  analysisType: 'deobfuscate' | 'vulnerabilities';
  provider?: string;
  additionalParams?: Record<string, any>;
}

export interface CacheManager {
  get<T = CacheableResult>(key: string): Promise<T | null>;
  set<T = CacheableResult>(key: string, value: T, options?: Partial<CacheEntry>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  generateKey(params: CacheKeyParams): string;
  getStats(): CacheStats;
  has(key: string): Promise<boolean>;
  prune(): Promise<number>;
}