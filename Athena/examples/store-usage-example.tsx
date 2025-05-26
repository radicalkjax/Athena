import React from 'react';
import { View, Text, Button } from 'react-native';
import { 
  useAnalysisState, 
  useAnalysisActions,
  useSelectedAnalysisResult,
  useAnalysisSuccessRate,
  useVulnerabilityStats 
} from '@/store/selectors';
import { useStoreSubscription } from '@/store/utils/subscriptions';
import { useSecurityStore, useQuarantineMode } from '@/store/securityStore';

/**
 * Example component demonstrating optimized store usage
 */
export function StoreUsageExample() {
  // Use shallow equality selectors for better performance
  const { isAnalyzing, analysisResults } = useAnalysisState();
  const { setIsAnalyzing, addAnalysisResult } = useAnalysisActions();
  
  // Use computed selectors
  const selectedResult = useSelectedAnalysisResult();
  const successRate = useAnalysisSuccessRate();
  const vulnStats = useVulnerabilityStats();
  
  // Use security store
  const isQuarantineMode = useQuarantineMode();
  const { addSecurityAlert } = useSecurityStore();
  
  // Subscribe to specific state changes
  useStoreSubscription(
    (state) => state.analysisResults.length,
    (count) => {
      console.log(`Analysis results count changed: ${count}`);
    }
  );
  
  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
    
    // Simulate analysis
    setTimeout(() => {
      addAnalysisResult({
        id: `result-${Date.now()}`,
        malwareId: 'sample-malware',
        modelId: 'gpt-4',
        timestamp: Date.now(),
        vulnerabilities: [
          {
            id: 'vuln-1',
            name: 'Buffer Overflow',
            description: 'Potential buffer overflow in function X',
            severity: 'high',
          }
        ]
      });
      
      setIsAnalyzing(false);
    }, 2000);
  };
  
  return (
    <View style={{ padding: 20 }}>
      <Text>Store Usage Example</Text>
      
      {/* Status Display */}
      <View style={{ marginVertical: 10 }}>
        <Text>Analysis Status: {isAnalyzing ? 'Analyzing...' : 'Idle'}</Text>
        <Text>Results Count: {analysisResults.length}</Text>
        <Text>Success Rate: {successRate.toFixed(2)}%</Text>
        <Text>Total Vulnerabilities: {vulnStats.total}</Text>
        <Text>Quarantine Mode: {isQuarantineMode ? 'ACTIVE' : 'Inactive'}</Text>
      </View>
      
      {/* Vulnerability Breakdown */}
      <View style={{ marginVertical: 10 }}>
        <Text>Vulnerabilities by Severity:</Text>
        <Text>  Critical: {vulnStats.bySeverity.critical}</Text>
        <Text>  High: {vulnStats.bySeverity.high}</Text>
        <Text>  Medium: {vulnStats.bySeverity.medium}</Text>
        <Text>  Low: {vulnStats.bySeverity.low}</Text>
      </View>
      
      {/* Selected Result */}
      {selectedResult && (
        <View style={{ marginVertical: 10 }}>
          <Text>Selected Result:</Text>
          <Text>  ID: {selectedResult.id}</Text>
          <Text>  Model: {selectedResult.modelId}</Text>
          <Text>  Vulnerabilities: {selectedResult.vulnerabilities?.length || 0}</Text>
        </View>
      )}
      
      {/* Actions */}
      <Button 
        title="Start Analysis" 
        onPress={handleStartAnalysis}
        disabled={isAnalyzing}
      />
      
      <Button 
        title="Trigger Security Alert" 
        onPress={() => {
          addSecurityAlert({
            type: 'suspicious_activity',
            severity: 'medium',
            message: 'Manual security alert for testing',
          });
        }}
      />
    </View>
  );
}