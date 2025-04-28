import React, { useState } from 'react';
import { View, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import ContainerConfigSelector from './ContainerConfigSelector';
import { ContainerConfig, AIModelType } from '@/types';
import { getResourcePreset } from '../services/container';

interface AnalysisOptionsPanelProps {
  onOptionsChange: (options: AnalysisOptions) => void;
  initialOptions?: Partial<AnalysisOptions>;
}

export interface AnalysisOptions {
  useContainerIsolation: boolean;
  containerConfig: ContainerConfig;
  aiModel: AIModelType;
  deepAnalysis: boolean;
  saveResults: boolean;
}

const DEFAULT_OPTIONS: AnalysisOptions = {
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
      <View style={styles.section}>
        <View style={styles.optionRow}>
          <ThemedText style={styles.optionTitle}>Use Container Isolation</ThemedText>
          <Switch
            value={options.useContainerIsolation}
            onValueChange={(value) => handleOptionChange('useContainerIsolation', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor="#f4f3f4"
          />
        </View>
        
        <ThemedText style={styles.optionDescription}>
          Run malware analysis in an isolated container environment for enhanced security.
        </ThemedText>
      </View>
      
      {options.useContainerIsolation && (
        <View style={styles.containerSection}>
          <ThemedText style={styles.sectionTitle}>Container Configuration</ThemedText>
          <ContainerConfigSelector
            onConfigChange={handleContainerConfigChange}
            initialConfig={options.containerConfig}
          />
        </View>
      )}
      
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>AI Model</ThemedText>
        <View style={styles.modelOptions}>
          <TouchableOpacity
            style={[
              styles.modelOption,
              options.aiModel === 'openai' && { borderColor: accentColor, borderWidth: 2 }
            ]}
            onPress={() => handleOptionChange('aiModel', 'openai')}
          >
            <ThemedText style={styles.modelButtonText}>OpenAI</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modelOption,
              options.aiModel === 'claude' && { borderColor: accentColor, borderWidth: 2 }
            ]}
            onPress={() => handleOptionChange('aiModel', 'claude')}
          >
            <ThemedText style={styles.modelButtonText}>Claude</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modelOption,
              options.aiModel === 'deepseek' && { borderColor: accentColor, borderWidth: 2 }
            ]}
            onPress={() => handleOptionChange('aiModel', 'deepseek')}
          >
            <ThemedText style={styles.modelButtonText}>Deepseek</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modelOption,
              options.aiModel === 'local' && { borderColor: accentColor, borderWidth: 2 }
            ]}
            onPress={() => handleOptionChange('aiModel', 'local')}
          >
            <ThemedText style={styles.modelButtonText}>Local</ThemedText>
          </TouchableOpacity>
        </View>
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
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
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
  modelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  modelOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 12,
    marginBottom: 12,
    minWidth: 100,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modelButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default AnalysisOptionsPanel;
