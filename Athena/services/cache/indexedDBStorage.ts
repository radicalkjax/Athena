/**
 * IndexedDB-based cache storage implementation for web platform
 */

import { CacheStorage, CacheEntry } from './types';

const DB_NAME = 'athena-analysis-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache-entries';

export class IndexedDBCacheStorage implements CacheStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize DB on first use
  }

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction([STORE_NAME], mode);
    return transaction.objectStore(STORE_NAME);
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const store = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          const entry = request.result;
          if (!entry) {
            resolve(null);
            return;
          }

          // Check if expired
          if (entry.expiresAt < Date.now()) {
            this.delete(key).catch(console.error);
            resolve(null);
            return;
          }

          // Update hit count
          entry.hits++;
          this.set(key, entry).catch(console.error);
          
          resolve(entry);
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const store = await this.getStore('readwrite');
      
      return new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const store = await this.getStore('readwrite');
      
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const store = await this.getStore('readwrite');
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const store = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getKeys error:', error);
      return [];
    }
  }

  async getSize(): Promise<number> {
    try {
      const store = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        let totalSize = 0;
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            totalSize += cursor.value.size;
            cursor.continue();
          } else {
            resolve(totalSize);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getSize error:', error);
      return 0;
    }
  }

  async getAllEntries(): Promise<Array<[string, CacheEntry]>> {
    try {
      const store = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        const entries: Array<[string, CacheEntry]> = [];
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            entries.push([cursor.value.key, cursor.value]);
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getAllEntries error:', error);
      return [];
    }
  }
}