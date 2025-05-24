import React, { useState } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks';
import ContainerConfigSelector from './ContainerConfigSelector';
import { ContainerConfig } from '@/types';
import { getResourcePreset } from '../services/container';

interface AnalysisOptionsPanelProps {
  onOptionsChange: (options: AnalysisOptions) => void;
  initialOptions?: Partial<AnalysisOptions>;
}

export interface AnalysisOptions {
  containerConfig: ContainerConfig;
  deepAnalysis: boolean;
  saveResults: boolean;
}

const DEFAULT_OPTIONS: AnalysisOptions = {
  containerConfig: {
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10',
    resources: getResourcePreset('standard')
  },
  deepAnalysis: false,
  saveResults: true
};

const AnalysisOptionsPanel: React.FC<AnalysisOptionsPanelProps> = ({
  onOptionsChange,
  initialOptions
}) => {
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const accentColor = useThemeColor({}, 'tint');
  
  // Merge initial options with defaults
  const mergedInitialOptions = { ...DEFAULT_OPTIONS, ...initialOptions };
  
  // State for analysis options
  const [options, setOptions] = useState<AnalysisOptions>(mergedInitialOptions);
  
  // Handle option changes
  const handleOptionChange = <K extends keyof AnalysisOptions>(
    key: K,
    value: AnalysisOptions[K]
  ) => {
    const updatedOptions = { ...options, [key]: value };
    setOptions(updatedOptions);
    onOptionsChange(updatedOptions);
  };
  
  // Handle container config changes
  const handleContainerConfigChange = (containerConfig: ContainerConfig) => {
    handleOptionChange('containerConfig', containerConfig);
  };
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.containerSection}>
        <ThemedText style={styles.sectionTitle}>Container Configuration</ThemedText>
        <ThemedText style={styles.optionDescription}>
          Malware is always analyzed in an isolated container environment for enhanced security.
        </ThemedText>
        <ContainerConfigSelector
          onConfigChange={handleContainerConfigChange}
          initialConfig={options.containerConfig}
        />
      </View>
      
      
      <View style={styles.section}>
        <View style={styles.optionRow}>
          <ThemedText style={styles.optionTitle}>Deep Analysis</ThemedText>
          <Switch
            value={options.deepAnalysis}
            onValueChange={(value) => handleOptionChange('deepAnalysis', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor="#f4f3f4"
          />
        </View>
        
        <ThemedText style={styles.optionDescription}>
          Perform more thorough analysis with detailed behavior monitoring. Takes longer but provides more comprehensive results.
        </ThemedText>
      </View>
      
      <View style={styles.section}>
        <View style={styles.optionRow}>
          <ThemedText style={styles.optionTitle}>Save Results</ThemedText>
          <Switch
            value={options.saveResults}
            onValueChange={(value) => handleOptionChange('saveResults', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor="#f4f3f4"
          />
        </View>
        
        <ThemedText style={styles.optionDescription}>
          Save analysis results to the database for future reference.
        </ThemedText>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#ffd1dd',
    borderRadius: 8,
  },
  containerSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#ffd1dd',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  optionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    color: '#000',
  },
});

export default AnalysisOptionsPanel;
