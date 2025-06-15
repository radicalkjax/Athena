import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { ContainerConfig, ContainerResourceLimits } from '@/types';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks';
import { getResourcePreset } from '../services/container';
import { Colors } from '@/constants/Colors';

const tintColorLight = Colors.light.tint;

interface ContainerConfigSelectorProps {
  onConfigChange: (config: ContainerConfig) => void;
  initialConfig?: Partial<ContainerConfig>;
}

const ContainerConfigSelector: React.FC<ContainerConfigSelectorProps> = ({
  onConfigChange,
  initialConfig
}) => {
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const dropdownTextColor = '#000000'; // Always black for better visibility

  const [config, setConfig] = useState<ContainerConfig>({
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10',
    resources: getResourcePreset('standard'),
    ...initialConfig
  });

  const [resourcesMode, setResourcesMode] = useState<'preset' | 'custom'>('preset');
  const [resourcePreset, setResourcePreset] = useState<'minimal' | 'standard' | 'performance' | 'intensive'>('standard');

  const handleOSChange = (os: string) => {
    const newConfig = {
      ...config,
      os: os as ContainerConfig['os'],
      version: os === 'windows' ? 'windows-10' : os === 'linux' ? 'ubuntu-22.04' : 'macos-13'
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleArchitectureChange = (arch: string) => {
    const newConfig = {
      ...config,
      architecture: arch as ContainerConfig['architecture']
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleResourcePresetChange = (preset: string) => {
    const presetType = preset as 'minimal' | 'standard' | 'performance' | 'intensive';
    setResourcePreset(presetType);
    const resources = getResourcePreset(presetType, config.os);
    const newConfig = {
      ...config,
      resources
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleResourceModeChange = (mode: string) => {
    setResourcesMode(mode as 'preset' | 'custom');
    if (mode === 'preset') {
      handleResourcePresetChange(resourcePreset);
    }
  };

  const handleCustomResourceChange = (resource: keyof ContainerResourceLimits, value: number) => {
    const currentResources = config.resources || getResourcePreset('standard');
    const newConfig = {
      ...config,
      resources: {
        ...currentResources,
        [resource]: value
      } as ContainerResourceLimits
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.optionSection}>
        <ThemedText style={styles.label}>Operating System</ThemedText>
        <View style={[styles.pickerContainer, { borderColor }]}>
          <Picker
            selectedValue={config.os}
            onValueChange={handleOSChange}
            style={[styles.picker, { color: dropdownTextColor }]}
            dropdownIconColor={dropdownTextColor}
            itemStyle={{ color: dropdownTextColor }}
          >
            <Picker.Item label="Windows" value="windows" color={dropdownTextColor} />
            <Picker.Item label="Linux" value="linux" color={dropdownTextColor} />
            <Picker.Item label="macOS" value="macos" color={dropdownTextColor} />
          </Picker>
        </View>
      </View>

      <View style={styles.optionSection}>
        <ThemedText style={styles.label}>Architecture</ThemedText>
        <View style={[styles.pickerContainer, { borderColor }]}>
          <Picker
            selectedValue={config.architecture}
            onValueChange={handleArchitectureChange}
            style={[styles.picker, { color: dropdownTextColor }]}
            dropdownIconColor={dropdownTextColor}
            itemStyle={{ color: dropdownTextColor }}
          >
            <Picker.Item label="x64 (64-bit)" value="x64" color={dropdownTextColor} />
            <Picker.Item label="x86 (32-bit)" value="x86" color={dropdownTextColor} />
            <Picker.Item label="ARM64" value="arm64" color={dropdownTextColor} />
          </Picker>
        </View>
      </View>

      <View style={styles.optionSection}>
        <ThemedText style={styles.label}>Resources</ThemedText>
        <View style={[styles.pickerContainer, { borderColor }]}>
          <Picker
            selectedValue={resourcesMode}
            onValueChange={handleResourceModeChange}
            style={[styles.picker, { color: dropdownTextColor }]}
            dropdownIconColor={dropdownTextColor}
            itemStyle={{ color: dropdownTextColor }}
          >
            <Picker.Item label="Preset Configuration" value="preset" color={dropdownTextColor} />
            <Picker.Item label="Custom Configuration" value="custom" color={dropdownTextColor} />
          </Picker>
        </View>

        {resourcesMode === 'preset' ? (
          <View style={[styles.resourcePresetContainer, { marginTop: 10 }]}>
            <View style={[styles.pickerContainer, { borderColor }]}>
              <Picker
                selectedValue={resourcePreset}
                onValueChange={handleResourcePresetChange}
                style={[styles.picker, { color: dropdownTextColor }]}
                dropdownIconColor={dropdownTextColor}
                itemStyle={{ color: dropdownTextColor }}
              >
                <Picker.Item label="Minimal (1 CPU, 2GB RAM)" value="minimal" color={dropdownTextColor} />
                <Picker.Item label="Standard (2 CPU, 4GB RAM)" value="standard" color={dropdownTextColor} />
                <Picker.Item label="Performance (4 CPU, 8GB RAM)" value="performance" color={dropdownTextColor} />
                <Picker.Item label="Intensive (8 CPU, 16GB RAM)" value="intensive" color={dropdownTextColor} />
              </Picker>
            </View>
          </View>
        ) : (
          <View style={styles.customResourcesContainer}>
            <View style={styles.sliderSection}>
              <ThemedText style={styles.sliderLabel}>CPU Cores: {config.resources?.cpu || 1}</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={8}
                step={1}
                value={config.resources?.cpu || 1}
                onValueChange={(value) => handleCustomResourceChange('cpu', value)}
                minimumTrackTintColor={tintColorLight}
                maximumTrackTintColor={borderColor}
                thumbTintColor={tintColorLight}
              />
            </View>

            <View style={styles.sliderSection}>
              <ThemedText style={styles.sliderLabel}>Memory: {config.resources?.memory || 2048}MB</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1024}
                maximumValue={16384}
                step={1024}
                value={config.resources?.memory || 2048}
                onValueChange={(value) => handleCustomResourceChange('memory', value)}
                minimumTrackTintColor={tintColorLight}
                maximumTrackTintColor={borderColor}
                thumbTintColor={tintColorLight}
              />
            </View>

            <View style={styles.sliderSection}>
              <ThemedText style={styles.sliderLabel}>Disk Space: {config.resources?.diskSpace || 5120}MB</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={5120}
                maximumValue={40960}
                step={5120}
                value={config.resources?.diskSpace || 5120}
                onValueChange={(value) => handleCustomResourceChange('diskSpace', value)}
                minimumTrackTintColor={tintColorLight}
                maximumTrackTintColor={borderColor}
                thumbTintColor={tintColorLight}
              />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.resourceInfo, { backgroundColor: backgroundColor }]}>
        <ThemedText style={styles.resourceLabel}>Current Configuration:</ThemedText>
        <ThemedText style={styles.resourceValue}>
          CPU: {config.resources?.cpu || 1} cores, RAM: {config.resources?.memory || 2048}MB, Disk: {config.resources?.diskSpace || 5120}MB
        </ThemedText>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  optionSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000', // Black text for labels
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // White background for better contrast
  },
  picker: {
    height: Platform.OS === 'ios' ? 180 : 50,
  },
  resourcePresetContainer: {
    marginTop: 10,
  },
  customResourcesContainer: {
    marginTop: 10,
  },
  sliderSection: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#000000', // Black text for slider labels
  },
  slider: {
    width: '100%',
    height: 40,
  },
  resourceInfo: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
  },
  resourceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000', // Black text for resource labels
  },
  resourceValue: {
    fontSize: 14,
    color: '#000000', // Black text for resource values
  },
});

export default ContainerConfigSelector;