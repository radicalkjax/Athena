import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppStore } from '@/store';
import * as containerDbService from '@/services/container-db';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Collapsible } from './Collapsible';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ContainerMonitoringProps {
  containerId: string;
  refreshInterval?: number; // in milliseconds
}

interface MonitoringSummary {
  averageCpuUsage: number;
  averageMemoryUsage: number;
  totalNetworkInbound: number;
  totalNetworkOutbound: number;
  totalFileOperations: number;
  totalProcesses: number;
  suspiciousActivityCount: number;
}

interface SuspiciousActivities {
  networkActivities: any[];
  fileActivities: any[];
  processActivities: any[];
}

const ContainerMonitoring: React.FC<ContainerMonitoringProps> = ({
  containerId,
  refreshInterval = 5000,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivities | null>(null);
  const [networkActivities, setNetworkActivities] = useState<any[]>([]);
  const [fileActivities, setFileActivities] = useState<any[]>([]);
  const [processActivities, setProcessActivities] = useState<any[]>([]);
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  
  // Function to load monitoring data
  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get container monitoring summary
      const summaryData = await containerDbService.getContainerMonitoringSummary(containerId);
      setSummary(summaryData);
      
      // Get suspicious activities
      const suspiciousData = await containerDbService.getSuspiciousActivities(containerId);
      setSuspiciousActivities(suspiciousData);
      
      // Get recent network activities
      const networkData = await containerDbService.getNetworkActivityByContainerId(containerId, 10);
      setNetworkActivities(networkData);
      
      // Get recent file activities
      const fileData = await containerDbService.getFileActivityByContainerId(containerId, 10);
      setFileActivities(fileData);
      
      // Get recent process activities
      const processData = await containerDbService.getProcessActivityByContainerId(containerId, 10);
      setProcessActivities(processData);
      
      setLoading(false);
    } catch (err) {
      setError(`Error loading monitoring data: ${(err as Error).message}`);
      setLoading(false);
    }
  };
  
  // Load monitoring data on mount and at regular intervals
  useEffect(() => {
    loadMonitoringData();
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      loadMonitoringData();
    }, refreshInterval);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [containerId, refreshInterval]);
  
  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  // Format date to human-readable format
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };
  
  if (loading && !summary) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={styles.loadingText}>Loading monitoring data...</ThemedText>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={[styles.errorText, { color: 'red' }]}>{error}</ThemedText>
      </View>
    );
  }
  
  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      {/* Summary Section */}
      <ThemedView style={[styles.section, { borderColor }]}>
        <ThemedText style={styles.sectionTitle}>Monitoring Summary</ThemedText>
        {summary && (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>CPU Usage:</ThemedText>
              <ThemedText style={styles.summaryValue}>{summary.averageCpuUsage.toFixed(2)}%</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Memory Usage:</ThemedText>
              <ThemedText style={styles.summaryValue}>{summary.averageMemoryUsage.toFixed(2)} MB</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Network Inbound:</ThemedText>
              <ThemedText style={styles.summaryValue}>{formatBytes(summary.totalNetworkInbound)}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Network Outbound:</ThemedText>
              <ThemedText style={styles.summaryValue}>{formatBytes(summary.totalNetworkOutbound)}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>File Operations:</ThemedText>
              <ThemedText style={styles.summaryValue}>{summary.totalFileOperations}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Processes:</ThemedText>
              <ThemedText style={styles.summaryValue}>{summary.totalProcesses}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Suspicious Activities:</ThemedText>
              <ThemedText style={[styles.summaryValue, summary.suspiciousActivityCount > 0 ? { color: 'red' } : {}]}>
                {summary.suspiciousActivityCount}
              </ThemedText>
            </View>
          </View>
        )}
      </ThemedView>

      {/* Suspicious Activities Section */}
      {suspiciousActivities && (
        suspiciousActivities.networkActivities.length > 0 ||
        suspiciousActivities.fileActivities.length > 0 ||
        suspiciousActivities.processActivities.length > 0
      ) && (
        <ThemedView style={[styles.section, { borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: 'red' }]}>Suspicious Activities</ThemedText>
          
          {suspiciousActivities.networkActivities.length > 0 && (
            <Collapsible title="Network Activities">
              {suspiciousActivities.networkActivities.map((activity, index) => (
                <View key={`network-${index}`} style={[styles.activityItem, { borderColor }]}>
                  <ThemedText style={styles.activityTitle}>
                    {activity.protocol} {activity.sourceIp}:{activity.sourcePort} → {activity.destinationIp}:{activity.destinationPort}
                  </ThemedText>
                  <ThemedText style={styles.activityDetail}>Process: {activity.processName} (PID: {activity.processId})</ThemedText>
                  <ThemedText style={styles.activityDetail}>Status: {activity.status}</ThemedText>
                  <ThemedText style={[styles.activityDetail, { color: 'red' }]}>Reason: {activity.maliciousReason}</ThemedText>
                </View>
              ))}
            </Collapsible>
          )}
          
          {suspiciousActivities.fileActivities.length > 0 && (
            <Collapsible title="File Activities">
              {suspiciousActivities.fileActivities.map((activity, index) => (
                <View key={`file-${index}`} style={[styles.activityItem, { borderColor }]}>
                  <ThemedText style={styles.activityTitle}>
                    {activity.operation} {activity.filePath}
                  </ThemedText>
                  <ThemedText style={styles.activityDetail}>Type: {activity.fileType}</ThemedText>
                  <ThemedText style={styles.activityDetail}>Process: {activity.processName} (PID: {activity.processId})</ThemedText>
                  <ThemedText style={[styles.activityDetail, { color: 'red' }]}>Reason: {activity.maliciousReason}</ThemedText>
                </View>
              ))}
            </Collapsible>
          )}
          
          {suspiciousActivities.processActivities.length > 0 && (
            <Collapsible title="Process Activities">
              {suspiciousActivities.processActivities.map((activity, index) => (
                <View key={`process-${index}`} style={[styles.activityItem, { borderColor }]}>
                  <ThemedText style={styles.activityTitle}>
                    {activity.processName} (PID: {activity.processId})
                  </ThemedText>
                  <ThemedText style={styles.activityDetail}>Command: {activity.commandLine}</ThemedText>
                  <ThemedText style={styles.activityDetail}>User: {activity.user}</ThemedText>
                  <ThemedText style={styles.activityDetail}>Status: {activity.status}</ThemedText>
                  <ThemedText style={[styles.activityDetail, { color: 'red' }]}>Reason: {activity.maliciousReason}</ThemedText>
                </View>
              ))}
            </Collapsible>
          )}
        </ThemedView>
      )}

      {/* Network Activity Section */}
      <ThemedView style={[styles.section, { borderColor }]}>
        <ThemedText style={styles.sectionTitle}>Network Activity</ThemedText>
        {networkActivities.length > 0 ? (
          <View>
            {networkActivities.map((activity, index) => (
              <View key={`network-detail-${index}`} style={[styles.activityItem, { borderColor }]}>
                <ThemedText style={styles.activityTitle}>
                  {activity.protocol} {activity.sourceIp}:{activity.sourcePort} → {activity.destinationIp}:{activity.destinationPort}
                </ThemedText>
                <ThemedText style={styles.activityDetail}>Time: {formatDate(activity.timestamp)}</ThemedText>
                <ThemedText style={styles.activityDetail}>Direction: {activity.direction}</ThemedText>
                <ThemedText style={styles.activityDetail}>Status: {activity.status}</ThemedText>
                <ThemedText style={styles.activityDetail}>Process: {activity.processName} (PID: {activity.processId})</ThemedText>
                <ThemedText style={styles.activityDetail}>Data Size: {formatBytes(activity.dataSize)}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>No network activity recorded</ThemedText>
        )}
      </ThemedView>

      {/* File Activity Section */}
      <ThemedView style={[styles.section, { borderColor }]}>
        <ThemedText style={styles.sectionTitle}>File Activity</ThemedText>
        {fileActivities.length > 0 ? (
          <View>
            {fileActivities.map((activity, index) => (
              <View key={`file-detail-${index}`} style={[styles.activityItem, { borderColor }]}>
                <ThemedText style={styles.activityTitle}>
                  {activity.operation} {activity.filePath}
                </ThemedText>
                <ThemedText style={styles.activityDetail}>Time: {formatDate(activity.timestamp)}</ThemedText>
                <ThemedText style={styles.activityDetail}>Type: {activity.fileType}</ThemedText>
                <ThemedText style={styles.activityDetail}>Size: {formatBytes(activity.fileSize)}</ThemedText>
                <ThemedText style={styles.activityDetail}>Permissions: {activity.filePermissions}</ThemedText>
                <ThemedText style={styles.activityDetail}>Process: {activity.processName} (PID: {activity.processId})</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>No file activity recorded</ThemedText>
        )}
      </ThemedView>

      {/* Process Activity Section */}
      <ThemedView style={[styles.section, { borderColor }]}>
        <ThemedText style={styles.sectionTitle}>Process Activity</ThemedText>
        {processActivities.length > 0 ? (
          <View>
            {processActivities.map((activity, index) => (
              <View key={`process-detail-${index}`} style={[styles.activityItem, { borderColor }]}>
                <ThemedText style={styles.activityTitle}>
                  {activity.processName} (PID: {activity.processId})
                </ThemedText>
                <ThemedText style={styles.activityDetail}>Time: {formatDate(activity.timestamp)}</ThemedText>
                <ThemedText style={styles.activityDetail}>Command: {activity.commandLine}</ThemedText>
                <ThemedText style={styles.activityDetail}>User: {activity.user}</ThemedText>
                <ThemedText style={styles.activityDetail}>Status: {activity.status}</ThemedText>
                <ThemedText style={styles.activityDetail}>CPU: {activity.cpuUsage.toFixed(2)}%</ThemedText>
                <ThemedText style={styles.activityDetail}>Memory: {activity.memoryUsage} MB</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>No process activity recorded</ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryContainer: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activityItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  activityDetail: {
    fontSize: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default ContainerMonitoring;
