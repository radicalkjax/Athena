/**
 * SQLite Cache Module
 * Desktop-native caching using SQLite (per DeepWiki recommendations)
 * Replaces Redis for Tauri desktop applications
 *
 * DeepWiki guidance:
 * - SQLite is recommended for desktop apps (embedded, no external deps)
 * - Redis is NOT recommended for desktop (requires external server)
 * - Use rusqlite with bundled feature for production
 * - Use Mutex for thread-safe access (Connection is Send but not Sync)
 */

use rusqlite::{Connection, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use anyhow::{Context, Result};
use crate::metrics::{CACHE_HIT_RATE, CACHE_OPERATIONS};

#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub db_path: PathBuf,
    pub ttl: u64, // Default TTL in seconds
    pub key_prefix: String,
}

impl Default for CacheConfig {
    fn default() -> Self {
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("athena");

        std::fs::create_dir_all(&cache_dir).ok();

        Self {
            db_path: cache_dir.join("cache.db"),
            ttl: 300, // 5 minutes default
            key_prefix: "athena:".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct CacheEntry<T> {
    data: T,
    timestamp: u64,
    ttl: Option<u64>,
}

pub struct SqliteCache {
    conn: Mutex<Connection>,
    config: CacheConfig,
    stats: Mutex<CacheStats>,
}

#[derive(Debug, Default, Clone, Serialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub deletes: u64,
}

impl SqliteCache {
    /// Create new SQLite cache with production configuration per DeepWiki
    pub fn new(config: CacheConfig) -> Result<Self> {
        let conn = Connection::open(&config.db_path)
            .context("Failed to open SQLite cache database")?;

        // Create cache table with auto-expiration support
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                ttl INTEGER,
                expires_at INTEGER
            )",
            [],
        ).context("Failed to create cache table")?;

        // Create index on expires_at for efficient cleanup
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at)",
            [],
        ).context("Failed to create index")?;

        // Enable WAL mode for better concurrent performance (per rusqlite best practices)
        conn.pragma_update(None, "journal_mode", "WAL")
            .context("Failed to enable WAL mode")?;

        // Set prepared statement cache capacity (per DeepWiki)
        conn.set_prepared_statement_cache_capacity(64);

        Ok(Self {
            conn: Mutex::new(conn),
            config,
            stats: Mutex::new(CacheStats::default()),
        })
    }

    /// Get value from cache
    pub fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>> {
        let cache_key = self.build_key(key);
        let now = Self::current_timestamp()?;

        let conn = self.conn.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire cache connection lock: {}", e))?;

        // Use prepare_cached for better performance (per DeepWiki)
        let mut stmt = conn.prepare_cached(
            "SELECT value FROM cache WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)"
        )?;

        let result: Option<String> = stmt
            .query_row(params![cache_key, now], |row| row.get(0))
            .optional()?;

        drop(stmt); // Release statement before updating stats
        drop(conn); // Release lock before updating stats

        match result {
            Some(json_str) => {
                let entry: CacheEntry<T> = serde_json::from_str(&json_str)
                    .context("Failed to deserialize cache entry")?;

                let mut stats = self.stats.lock()
                    .map_err(|e| anyhow::anyhow!("Failed to acquire stats lock: {}", e))?;
                stats.hits += 1;
                drop(stats);

                // Record Prometheus metrics
                CACHE_OPERATIONS
                    .with_label_values(&["get", "hit"])
                    .inc();
                self.update_hit_rate();

                Ok(Some(entry.data))
            }
            None => {
                let mut stats = self.stats.lock()
                    .map_err(|e| anyhow::anyhow!("Failed to acquire stats lock: {}", e))?;
                stats.misses += 1;
                drop(stats);

                // Record Prometheus metrics
                CACHE_OPERATIONS
                    .with_label_values(&["get", "miss"])
                    .inc();
                self.update_hit_rate();

                Ok(None)
            }
        }
    }

    /// Set value in cache with TTL
    pub fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Option<u64>) -> Result<()> {
        let cache_key = self.build_key(key);
        let ttl_secs = ttl.unwrap_or(self.config.ttl);
        let timestamp = Self::current_timestamp()?;
        let expires_at = timestamp + ttl_secs;

        let entry = CacheEntry {
            data: value,
            timestamp,
            ttl: Some(ttl_secs),
        };

        let json_str = serde_json::to_string(&entry)
            .context("Failed to serialize cache entry")?;

        let conn = self.conn.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire cache connection lock: {}", e))?;

        // Use prepare_cached for better performance (per DeepWiki)
        let mut stmt = conn.prepare_cached(
            "INSERT OR REPLACE INTO cache (key, value, timestamp, ttl, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5)"
        )?;

        stmt.execute(params![cache_key, json_str, timestamp, ttl_secs, expires_at])?;

        drop(stmt);
        drop(conn);

        let mut stats = self.stats.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire stats lock: {}", e))?;
        stats.sets += 1;
        drop(stats);

        // Record Prometheus metrics
        CACHE_OPERATIONS
            .with_label_values(&["set", "success"])
            .inc();

        Ok(())
    }

    /// Delete key from cache
    pub fn delete(&self, key: &str) -> Result<bool> {
        let cache_key = self.build_key(key);

        let conn = self.conn.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire cache connection lock: {}", e))?;
        let rows_affected = conn.execute("DELETE FROM cache WHERE key = ?1", params![cache_key])?;
        drop(conn);

        let mut stats = self.stats.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire stats lock: {}", e))?;
        stats.deletes += 1;
        drop(stats);

        // Record Prometheus metrics
        CACHE_OPERATIONS
            .with_label_values(&["delete", "success"])
            .inc();

        Ok(rows_affected > 0)
    }

    /// Clean up expired entries
    pub fn cleanup_expired(&self) -> Result<usize> {
        let now = Self::current_timestamp()?;
        let conn = self.conn.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire cache connection lock: {}", e))?;
        let count = conn.execute(
            "DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at <= ?1",
            params![now]
        )?;
        Ok(count)
    }

    /// Update cache hit rate metric
    fn update_hit_rate(&self) {
        // Non-critical operation - if lock fails, just skip metric update
        if let Ok(stats) = self.stats.lock() {
            let total = stats.hits + stats.misses;
            if total > 0 {
                let hit_rate = (stats.hits as f64 / total as f64) * 100.0;
                CACHE_HIT_RATE
                    .with_label_values(&["sqlite"])
                    .set(hit_rate);
            }
        }
    }

    /// Check if key exists
    pub fn exists(&self, key: &str) -> Result<bool> {
        let cache_key = self.build_key(key);
        let now = Self::current_timestamp()?;

        let conn = self.conn.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire cache connection lock: {}", e))?;
        let mut stmt = conn.prepare_cached(
            "SELECT 1 FROM cache WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)"
        )?;

        let exists = stmt.exists(params![cache_key, now])?;
        Ok(exists)
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> Result<CacheStats> {
        let stats = self.stats.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire stats lock: {}", e))?;
        Ok(stats.clone())
    }

    /// Build cache key with prefix
    fn build_key(&self, key: &str) -> String {
        format!("{}{}", self.config.key_prefix, key)
    }

    /// Get current Unix timestamp
    fn current_timestamp() -> Result<u64> {
        let duration = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .context("System time is before UNIX_EPOCH")?;
        Ok(duration.as_secs())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_operations() {
        let config = CacheConfig {
            db_path: PathBuf::from(":memory:"), // In-memory for tests
            ttl: 300,
            key_prefix: "test:".to_string(),
        };

        let cache = SqliteCache::new(config).unwrap();

        // Test set and get
        let test_data = "test_value";
        cache.set("test_key", &test_data, None).unwrap();

        let result: Option<String> = cache.get("test_key").unwrap();
        assert_eq!(result, Some(test_data.to_string()));

        // Test exists
        assert!(cache.exists("test_key").unwrap());

        // Test delete
        cache.delete("test_key").unwrap();
        let result: Option<String> = cache.get("test_key").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_ttl_expiration() {
        let config = CacheConfig {
            db_path: PathBuf::from(":memory:"),
            ttl: 1, // 1 second TTL
            key_prefix: "test:".to_string(),
        };

        let cache = SqliteCache::new(config).unwrap();

        // Set with 0 second TTL (should expire immediately)
        cache.set("expiring_key", &"value", Some(0)).unwrap();

        // Should be expired
        let result: Option<String> = cache.get("expiring_key").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_cleanup() {
        let config = CacheConfig {
            db_path: PathBuf::from(":memory:"),
            ttl: 1,
            key_prefix: "test:".to_string(),
        };

        let cache = SqliteCache::new(config).unwrap();

        // Add some expired entries
        cache.set("key1", &"value1", Some(0)).unwrap();
        cache.set("key2", &"value2", Some(0)).unwrap();

        // Cleanup should remove them
        let cleaned = cache.cleanup_expired().unwrap();
        assert_eq!(cleaned, 2);
    }
}
