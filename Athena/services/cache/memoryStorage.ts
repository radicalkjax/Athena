/**
 * Memory-based cache storage implementation
 */

import { CacheStorage, CacheEntry } from './types';

export class MemoryCacheStorage implements CacheStorage {
  private cache: Map<string, CacheEntry>;
  private sizeTracker: number;

  constructor() {
    this.cache = new Map();
    this.sizeTracker = 0;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      await this.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.sizeTracker -= existingEntry.size;
    }

    this.cache.set(key, entry as CacheEntry);
    this.sizeTracker += entry.size;
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.sizeTracker -= entry.size;
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.sizeTracker = 0;
  }

  async getKeys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async getSize(): Promise<number> {
    return this.sizeTracker;
  }

  // Helper method to get all entries for pruning
  async getAllEntries(): Promise<Array<[string, CacheEntry]>> {
    return Array.from(this.cache.entries());
  }
}