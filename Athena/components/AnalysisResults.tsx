import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { AnalysisResult, Vulnerability } from '@/types';
import { useColorScheme } from '@/hooks';
import { Colors } from '@/constants/Colors';
import { formatTimestamp } from '@/utils/helpers';
import { Button, Card } from '@/design-system';

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, isAnalyzing }) => {
  const colorScheme = useColorScheme();
  const [activeTab, setActiveTab] = useState<'code' | 'report' | 'vulnerabilities'>('code');
  
  if (isAnalyzing) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <ThemedText style={styles.loadingText}>Analyzing malware...</ThemedText>
        <ThemedText style={styles.loadingSubtext}>
          This may take a few minutes depending on the file size and complexity.
        </ThemedText>
      </ThemedView>
    );
  }
  
  if (!result) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <IconSymbol name="doc.text.magnifyingglass" size={48} color="#AAAAAA" />
        <ThemedText style={styles.emptyText}>
          Select a file and AI model, then click "Analyze" to start.
        </ThemedText>
      </ThemedView>
    );
  }
  
  if (result.error) {
    return (
      <Card variant="outlined" style={styles.errorContainer}>
        <IconSymbol name="exclamationmark.triangle" size={32} color="#FF6B6B" />
        <ThemedText style={styles.errorTitle}>Analysis Failed</ThemedText>
        <ThemedText style={styles.errorText}>{result.error}</ThemedText>
      </Card>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Analysis Results</ThemedText>
        <ThemedText style={styles.timestamp}>{formatTimestamp(result.timestamp)}</ThemedText>
      </View>
      
      <View style={styles.tabContainer}>
        <Button
          variant={activeTab === 'code' ? 'primary' : 'secondary'}
          size="small"
          onPress={() => setActiveTab('code')}
          style={styles.tabButton}
        >
          <View style={styles.tabContent}>
            <IconSymbol
              name="doc.text"
              size={16}
              color={activeTab === 'code' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text}
            />
            <ThemedText
              style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}
            >
              Deobfuscated Code
            </ThemedText>
          </View>
        </Button>
        
        <Button
          variant={activeTab === 'report' ? 'primary' : 'secondary'}
          size="small"
          onPress={() => setActiveTab('report')}
          style={styles.tabButton}
        >
          <View style={styles.tabContent}>
            <IconSymbol
              name="doc.text.magnifyingglass"
              size={16}
              color={activeTab === 'report' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text}
            />
            <ThemedText
              style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}
            >
              Analysis Report
            </ThemedText>
          </View>
        </Button>
        
        <Button
          variant={activeTab === 'vulnerabilities' ? 'primary' : 'secondary'}
          size="small"
          onPress={() => setActiveTab('vulnerabilities')}
          style={styles.tabButton}
        >
          <View style={styles.tabContent}>
            <IconSymbol
              name="exclamationmark.shield"
              size={16}
              color={activeTab === 'vulnerabilities' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text}
            />
            <ThemedText
              style={[styles.tabText, activeTab === 'vulnerabilities' && styles.activeTabText]}
            >
              Vulnerabilities {result.vulnerabilities?.length ? `(${result.vulnerabilities.length})` : ''}
            </ThemedText>
          </View>
        </Button>
      </View>
      
      <ThemedView style={styles.contentContainer}>
        {activeTab === 'code' && (
          <ScrollView style={styles.codeContainer}>
            {result.deobfuscatedCode ? (
              <ThemedText style={styles.codeText}>{result.deobfuscatedCode}</ThemedText>
            ) : (
              <ThemedView style={styles.noContentContainer}>
                <IconSymbol name="doc.text" size={32} color="#AAAAAA" />
                <ThemedText style={styles.noContentText}>
                  No deobfuscated code available.
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>
        )}
        
        {activeTab === 'report' && (
          <ScrollView style={styles.reportContainer}>
            {result.analysisReport ? (
              <ThemedText style={styles.reportText}>{result.analysisReport}</ThemedText>
            ) : (
              <ThemedView style={styles.noContentContainer}>
                <IconSymbol name="doc.text.magnifyingglass" size={32} color="#AAAAAA" />
                <ThemedText style={styles.noContentText}>
                  No analysis report available.
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>
        )}
        
        {activeTab === 'vulnerabilities' && (
          <ScrollView style={styles.vulnerabilitiesContainer}>
            {result.vulnerabilities && result.vulnerabilities.length > 0 ? (
              result.vulnerabilities.map((vulnerability, index) => (
                <VulnerabilityItem key={index} vulnerability={vulnerability} />
              ))
            ) : (
              <ThemedView style={styles.noContentContainer}>
                <IconSymbol name="checkmark.shield" size={32} color="#4CAF50" />
                <ThemedText style={styles.noContentText}>
                  No vulnerabilities detected.
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>
        )}
      </ThemedView>
    </ThemedView>
  );
};

interface VulnerabilityItemProps {
  vulnerability: Vulnerability;
}

const VulnerabilityItem: React.FC<VulnerabilityItemProps> = ({ vulnerability }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#FF0000';
      case 'high':
        return '#FF6B6B';
      case 'medium':
        return '#FFA500';
      case 'low':
        return '#4CAF50';
      default:
        return '#4A90E2';
    }
  };
  
  return (
    <Card variant="outlined" style={styles.vulnerabilityItem}>
      <TouchableOpacity
        style={styles.vulnerabilityHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.vulnerabilityTitleContainer}>
          <View
            style={[
              styles.severityIndicator,
              { backgroundColor: getSeverityColor(vulnerability.severity) },
            ]}
          />
          <ThemedText style={styles.vulnerabilityTitle}>{vulnerability.name}</ThemedText>
        </View>
        <View style={styles.vulnerabilityHeaderRight}>
          <ThemedText style={styles.severityText}>
            {vulnerability.severity.toUpperCase()}
          </ThemedText>
          <IconSymbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={16}
            color="#AAAAAA"
          />
        </View>
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.vulnerabilityDetails}>
          <ThemedText style={styles.vulnerabilityDescription}>
            {vulnerability.description}
          </ThemedText>
          
          {vulnerability.cveId && (
            <View style={styles.vulnerabilityInfoItem}>
              <ThemedText style={styles.vulnerabilityInfoLabel}>CVE ID:</ThemedText>
              <ThemedText style={styles.vulnerabilityInfoValue}>{vulnerability.cveId}</ThemedText>
            </View>
          )}
          
          {vulnerability.metasploitModule && (
            <View style={styles.vulnerabilityInfoItem}>
              <ThemedText style={styles.vulnerabilityInfoLabel}>Metasploit Module:</ThemedText>
              <ThemedText style={styles.vulnerabilityInfoValue}>
                {vulnerability.metasploitModule}
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 8,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  tabButton: {
    flex: 0,
    marginRight: 0,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  contentContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 300,
  },
  codeContainer: {
    padding: 10,
    maxHeight: 400,
  },
  codeText: {
    fontSize: 14,
  },
  reportContainer: {
    padding: 10,
    maxHeight: 400,
  },
  reportText: {
    fontSize: 14,
    lineHeight: 20,
  },
  vulnerabilitiesContainer: {
    padding: 10,
    maxHeight: 400,
  },
  vulnerabilityItem: {
    marginBottom: 10,
  },
  vulnerabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  vulnerabilityTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  vulnerabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  vulnerabilityHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  vulnerabilityDetails: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  vulnerabilityDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  vulnerabilityInfoItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  vulnerabilityInfoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 5,
  },
  vulnerabilityInfoValue: {
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#AAAAAA',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    borderColor: '#FF6B6B',
  },
  errorTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  errorText: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
    color: '#FF6B6B',
  },
  noContentContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  noContentText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#AAAAAA',
  },
});
