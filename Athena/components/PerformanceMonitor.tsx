/**
 * Performance monitoring component for Phase 8 optimizations
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/design-system/components/Card';
import { aiServiceManager } from '@/services/ai/manager';
import { batchProcessor } from '@/services/batch/processor';
import { useThemeColor } from '@/hooks';

interface PerformanceStats {
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    currentSize: number;
    maxSize: number;
    entryCount: number;
  };
  batch: {
    pendingRequests: number;
    activeRequests: number;
    completedRequests: number;
    failedRequests: number;
    averageProcessingTime: number;
  };
  providers: Record<string, {
    status: string;
    successRate: number;
    averageResponseTime: number;
  }>;
  pools?: Record<string, {
    size: number;
    available: number;
    inUse: number;
    peakSize: number;
  }>;
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');

  useEffect(() => {
    const updateStats = () => {
      const cacheStats = aiServiceManager.getCacheStats();
      const queueStatus = batchProcessor.getQueueStatus();
      const providerStatus = aiServiceManager.getProviderStatus();
      const poolStats = aiServiceManager.getPoolStats();
      
      const providers: PerformanceStats['providers'] = {};
      for (const [name, health] of providerStatus) {
        providers[name] = {
          status: health.status,
          successRate: health.successRate,
          averageResponseTime: health.averageResponseTime,
        };
      }
      
      const pools: PerformanceStats['pools'] = {};
      if (poolStats) {
        for (const [name, pool] of Object.entries(poolStats)) {
          pools[name] = {
            size: pool.size,
            available: pool.available,
            inUse: pool.inUse,
            peakSize: pool.peakSize,
          };
        }
      }
      
      setStats({
        cache: cacheStats,
        batch: queueStatus,
        providers,
        pools,
      });
    };
    
    updateStats();
    const interval = setInterval(updateStats, 2000);
    
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return null;
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: textColor }]}>Performance Metrics</Text>
      
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Cache Performance</Text>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Hit Rate:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {(stats.cache.hitRate * 100).toFixed(1)}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Hits/Misses:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {stats.cache.hits}/{stats.cache.misses}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Size:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {formatSize(stats.cache.currentSize)} / {formatSize(stats.cache.maxSize)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Entries:</Text>
          <Text style={[styles.value, { color: textColor }]}>{stats.cache.entryCount}</Text>
        </View>
      </Card>
      
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Batch Processing</Text>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Queue Status:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {stats.batch.pendingRequests} pending, {stats.batch.activeRequests} active
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Processed:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {stats.batch.completedRequests} completed, {stats.batch.failedRequests} failed
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: secondaryTextColor }]}>Avg Time:</Text>
          <Text style={[styles.value, { color: textColor }]}>
            {formatTime(stats.batch.averageProcessingTime)}
          </Text>
        </View>
      </Card>
      
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>AI Providers</Text>
        {Object.entries(stats.providers).map(([name, provider]) => (
          <View key={name} style={styles.providerRow}>
            <Text style={[styles.providerName, { color: textColor }]}>{name}:</Text>
            <View style={styles.providerStats}>
              <Text style={[
                styles.providerStatus,
                { color: provider.status === 'healthy' ? '#4CAF50' : '#FF5252' }
              ]}>
                {provider.status}
              </Text>
              <Text style={[styles.providerMetric, { color: secondaryTextColor }]}>
                {provider.successRate.toFixed(0)}% • {formatTime(provider.averageResponseTime)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      
      {stats.pools && Object.keys(stats.pools).length > 0 && (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Connection Pools</Text>
          {Object.entries(stats.pools).map(([name, pool]) => (
            <View key={name} style={styles.metric}>
              <Text style={[styles.label, { color: secondaryTextColor }]}>{name}:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {pool.inUse}/{pool.size} (peak: {pool.peakSize})
              </Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  providerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  providerMetric: {
    fontSize: 12,
  },
});