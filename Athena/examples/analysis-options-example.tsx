import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Button, Alert } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import AnalysisOptionsPanel, { AnalysisOptions } from '../components/AnalysisOptionsPanel';
import { getResourcePreset } from '../services/container';

/**
 * Example screen showing how to use the AnalysisOptionsPanel component
 */
const AnalysisOptionsExample = () => {
  // Initial options
  const initialOptions: AnalysisOptions = {
    useContainerIsolation: true,
    containerConfig: {
      os: 'windows',
      architecture: 'x64',
      version: 'windows-10',
      resources: getResourcePreset('standard')
    },
    aiModel: 'openai',
    deepAnalysis: false,
    saveResults: true
  };
  
  // State to store the current options
  const [options, setOptions] = useState<AnalysisOptions>(initialOptions);
  
  // Handle options changes
  const handleOptionsChange = (newOptions: AnalysisOptions) => {
    setOptions(newOptions);
    console.log('Options updated:', newOptions);
  };
  
  // Handle analysis start
  const handleStartAnalysis = () => {
    Alert.alert(
      'Analysis Configuration',
      `Starting analysis with the following configuration:
      
Container Isolation: ${options.useContainerIsolation ? 'Enabled' : 'Disabled'}
OS: ${options.containerConfig.os}
Architecture: ${options.containerConfig.architecture}
Version: ${options.containerConfig.version}
AI Model: ${options.aiModel}
Deep Analysis: ${options.deepAnalysis ? 'Enabled' : 'Disabled'}
Save Results: ${options.saveResults ? 'Yes' : 'No'}
CPU Cores: ${options.containerConfig.resources?.cpu || 'Default'}
Memory: ${options.containerConfig.resources?.memory || 'Default'} MB
Disk Space: ${options.containerConfig.resources?.diskSpace || 'Default'} MB
Network Speed: ${options.containerConfig.resources?.networkSpeed || 'Default'} Mbps
I/O Operations: ${options.containerConfig.resources?.ioOperations || 'Default'} IOPS`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Analysis', onPress: () => console.log('Analysis started with options:', options) }
      ]
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ThemedText style={styles.title}>Analysis Options</ThemedText>
        
        <ThemedText style={styles.description}>
          Configure the analysis options below. You can enable container isolation for enhanced security,
          select the container configuration, choose the AI model to use, and set additional analysis options.
        </ThemedText>
        
        <AnalysisOptionsPanel
          onOptionsChange={handleOptionsChange}
          initialOptions={initialOptions}
        />
        
        <View style={styles.buttonContainer}>
          <Button
            title="Start Analysis"
            onPress={handleStartAnalysis}
            color="#0a7ea4"
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    opacity: 0.8,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 48,
  },
});

export default AnalysisOptionsExample;
