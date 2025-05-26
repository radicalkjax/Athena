import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppStore } from '@/store';
// import * as containerDbService from '@/services/container-db';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Collapsible } from './Collapsible';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Card } from '@/design-system';

interface ContainerMonitoringProps {
  containerId: string;
  refreshInterval?: number; // in milliseconds
}

const ContainerMonitoring: React.FC<ContainerMonitoringProps> = ({
  containerId,
  refreshInterval = 5000,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  
  // Function to load monitoring data
  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For web compatibility, show placeholder message
      setError("Container monitoring is not available in web mode. This feature requires a backend database connection.");
      setLoading(false);
    } catch (err) {
      setError(`Error loading monitoring data: ${(err as Error).message}`);
      setLoading(false);
    }
  };
  
  // Load monitoring data on mount
  useEffect(() => {
    loadMonitoringData();
  }, [containerId]);
  
  if (loading) {
    return (
      <Card variant="filled" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={styles.loadingText}>Loading monitoring data...</ThemedText>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card variant="filled" style={styles.errorContainer}>
        <ThemedText style={[styles.errorText, { color: 'orange' }]}>{error}</ThemedText>
        <ThemedText style={styles.infoText}>
          Container monitoring will be available when running with a backend database connection.
        </ThemedText>
      </Card>
    );
  }
  
  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <Card variant="outlined" style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Container Monitoring</ThemedText>
        <ThemedText style={styles.infoText}>
          This component will display real-time container monitoring data when connected to a backend database.
        </ThemedText>
      </Card>
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
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});

export default ContainerMonitoring;
