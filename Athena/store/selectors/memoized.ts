import { createSelector } from 'zustand';
import { AppState } from '../types';
import { useAppStore } from '../index';

// Memoized selectors for expensive computations

// Get analysis results grouped by model
export const useAnalysisResultsByModel = () => useAppStore(
  createSelector(
    [(state: AppState) => state.analysisResults],
    (results) => {
      const grouped = new Map<string, typeof results>();
      
      results.forEach(result => {
        const modelResults = grouped.get(result.modelId) || [];
        grouped.set(result.modelId, [...modelResults, result]);
      });
      
      return grouped;
    }
  )
);

// Get containers by status
export const useContainersByStatus = () => useAppStore(
  createSelector(
    [(state: AppState) => state.containers],
    (containers) => {
      const grouped = {
        creating: [] as typeof containers,
        running: [] as typeof containers,
        stopped: [] as typeof containers,
        error: [] as typeof containers,
      };
      
      containers.forEach(container => {
        grouped[container.status].push(container);
      });
      
      return grouped;
    }
  )
);

// Get analysis success rate
export const useAnalysisSuccessRate = () => useAppStore(
  createSelector(
    [(state: AppState) => state.analysisResults],
    (results) => {
      if (results.length === 0) return 0;
      
      const successful = results.filter(r => !r.error).length;
      return (successful / results.length) * 100;
    }
  )
);

// Get vulnerability statistics
export const useVulnerabilityStats = () => useAppStore(
  createSelector(
    [(state: AppState) => state.analysisResults],
    (results) => {
      const stats = {
        total: 0,
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
      };
      
      results.forEach(result => {
        if (result.vulnerabilities) {
          result.vulnerabilities.forEach(vuln => {
            stats.total++;
            stats.bySeverity[vuln.severity]++;
          });
        }
      });
      
      return stats;
    }
  )
);

// Get recent analysis results (last 10)
export const useRecentAnalysisResults = () => useAppStore(
  createSelector(
    [(state: AppState) => state.analysisResults],
    (results) => [...results]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
  )
);

// Get active containers count
export const useActiveContainersCount = () => useAppStore(
  createSelector(
    [(state: AppState) => state.containers],
    (containers) => containers.filter(c => c.status === 'running').length
  )
);