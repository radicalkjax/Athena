# Analysis Options Panel

The Analysis Options Panel is a UI component that allows users to configure various options for malware analysis. This component provides a comprehensive interface for setting up analysis parameters, including container isolation, AI model selection, and analysis depth.

## Features

- Container isolation toggle
- Container configuration selection (when container isolation is enabled)
- AI model selection (OpenAI, Claude, DeepSeek, Local)
- Deep analysis toggle for more thorough analysis
- Save results toggle to store analysis results for future reference

## Usage

### Basic Usage

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import AnalysisOptionsPanel, { AnalysisOptions } from '@/components/AnalysisOptionsPanel';

const MyComponent = () => {
  const handleOptionsChange = (options: AnalysisOptions) => {
    console.log('Analysis options updated:', options);
    // Do something with the updated options
  };

  return (
    <View style={{ flex: 1 }}>
      <AnalysisOptionsPanel onOptionsChange={handleOptionsChange} />
    </View>
  );
};
```

### With Initial Options

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import AnalysisOptionsPanel, { AnalysisOptions } from '@/components/AnalysisOptionsPanel';
import { getResourcePreset } from '@/services/container';

const MyComponent = () => {
  // Define initial options
  const initialOptions: AnalysisOptions = {
    useContainerIsolation: true,
    containerConfig: {
      os: 'linux',
      architecture: 'x64',
      version: 'ubuntu-22.04',
      distribution: 'ubuntu',
      resources: getResourcePreset('performance')
    },
    aiModel: 'claude',
    deepAnalysis: true,
    saveResults: true
  };

  const handleOptionsChange = (options: AnalysisOptions) => {
    console.log('Analysis options updated:', options);
    // Do something with the updated options
  };

  return (
    <View style={{ flex: 1 }}>
      <AnalysisOptionsPanel 
        onOptionsChange={handleOptionsChange}
        initialOptions={initialOptions}
      />
    </View>
  );
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onOptionsChange` | `(options: AnalysisOptions) => void` | Yes | Callback function that is called when any analysis option changes |
| `initialOptions` | `Partial<AnalysisOptions>` | No | Initial analysis options |

## AnalysisOptions Interface

The `AnalysisOptions` interface defines the structure of the analysis options:

```typescript
interface AnalysisOptions {
  useContainerIsolation: boolean;
  containerConfig: ContainerConfig;
  aiModel: AIModelType;
  deepAnalysis: boolean;
  saveResults: boolean;
}
```

### Default Options

If no initial options are provided, the component uses the following default options:

```typescript
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
```

## Container Configuration

When container isolation is enabled, the component displays a `ContainerConfigSelector` component that allows users to configure the container settings. See the [ContainerConfigSelector](./CONTAINER_CONFIG_SELECTOR.md) documentation for more details.

## AI Model Selection

The component provides buttons for selecting the AI model to use for analysis:

- **OpenAI**: Uses OpenAI's models (e.g., GPT-4)
- **Claude**: Uses Anthropic's Claude models
- **DeepSeek**: Uses DeepSeek's models
- **Local**: Uses locally installed models

## Deep Analysis

The deep analysis option enables more thorough analysis with detailed behavior monitoring. This takes longer but provides more comprehensive results.

## Save Results

The save results option allows users to store analysis results in the database for future reference.

## Example

See the `analysis-options-example.tsx` file for a complete example of how to use the Analysis Options Panel in a screen:

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Button, Alert } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import AnalysisOptionsPanel, { AnalysisOptions } from '../components/AnalysisOptionsPanel';
import { getResourcePreset } from '../services/container';

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
```

## Integration with Other Components

The Analysis Options Panel is designed to be used in conjunction with other components in the analysis workflow:

1. **AIModelSelector**: The Analysis Options Panel includes AI model selection, but you can also use the standalone AIModelSelector component for more advanced model selection.
2. **ContainerConfigSelector**: When container isolation is enabled, the Analysis Options Panel displays a ContainerConfigSelector component for configuring the container.
3. **FileUploader**: Use the FileUploader component to upload files for analysis before configuring the analysis options.
4. **AnalysisResults**: After analysis is complete, use the AnalysisResults component to display the results.
