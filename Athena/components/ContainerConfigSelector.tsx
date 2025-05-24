import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Collapsible } from './Collapsible';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { 
  getAvailableWindowsVersions, 
  getAvailableLinuxVersions, 
  getAvailableMacOSVersions,
  getAvailableLinuxDistributions,
  getResourcePreset,
  createResourceLimits,
  checkSystemRequirements
} from '../services/container';
import { 
  ArchitectureType, 
  OSType, 
  ContainerResourceLimits,
  ContainerConfig
} from '@/types';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks';

type ResourcePresetType = 'minimal' | 'standard' | 'performance' | 'intensive' | 'custom';

interface ContainerConfigSelectorProps {
  onConfigChange: (config: ContainerConfig) => void;
  initialConfig?: Partial<ContainerConfig>;
}

const ContainerConfigSelector: React.FC<ContainerConfigSelectorProps> = ({ 
  onConfigChange,
  initialConfig
}) => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const accentColor = useThemeColor({}, 'tint');

  // OS selection state
  const [selectedOS, setSelectedOS] = useState<OSType>(initialConfig?.os || 'windows');
  const [selectedArchitecture, setSelectedArchitecture] = useState<ArchitectureType>(
    initialConfig?.architecture || 'x64'
  );
  const [selectedVersion, setSelectedVersion] = useState<string>(
    initialConfig?.version || 'windows-10'
  );
  const [linuxDistribution, setLinuxDistribution] = useState<string>(
    initialConfig?.distribution || 'ubuntu'
  );

  // Resource configuration state
  const [resourcePreset, setResourcePreset] = useState<ResourcePresetType>('minimal');
  const [resources, setResources] = useState<ContainerResourceLimits>(
    initialConfig?.resources || getResourcePreset('minimal', initialConfig?.os || 'windows')
  );

  // System requirements state
  const [systemRequirements, setSystemRequirements] = useState<{
    meetsRequirements: boolean;
    details: {
      cpu: { meets: boolean; available: number; required: number };
      memory: { meets: boolean; available: number; required: number };
      diskSpace: { meets: boolean; available: number; required: number };
    };
  } | null>(null);

  // Available options state
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [availableDistributions, setAvailableDistributions] = useState<string[]>([]);

  // Update available versions when OS or architecture changes
  useEffect(() => {
    updateAvailableVersions();
  }, [selectedOS, selectedArchitecture]);

  // Update available Linux distributions
  useEffect(() => {
    if (selectedOS === 'linux') {
      const distributions = getAvailableLinuxDistributions();
      setAvailableDistributions(distributions);
    }
  }, [selectedOS]);
  
  // Update resources when OS changes if using minimal preset
  useEffect(() => {
    if (resourcePreset === 'minimal') {
      setResources(getResourcePreset('minimal', selectedOS));
    }
  }, [selectedOS, resourcePreset]);

  // Check system requirements when resources change
  useEffect(() => {
    const checkResources = async () => {
      try {
        const systemCheck = await checkSystemRequirements(resources);
        setSystemRequirements(systemCheck);
        
        if (!systemCheck.meetsRequirements) {
          // System doesn't meet the requirements
          const details = systemCheck.details;
          let warningMessage = 'Warning: Your system may not meet the requirements for this container configuration:';
          
          if (!details.cpu.meets) {
            warningMessage += `\n- CPU: ${details.cpu.available} cores available, ${details.cpu.required} cores required`;
          }
          
          if (!details.memory.meets) {
            warningMessage += `\n- Memory: ${details.memory.available} MB available, ${details.memory.required} MB required`;
          }
          
          if (!details.diskSpace.meets) {
            warningMessage += `\n- Disk Space: ${details.diskSpace.available} MB available, ${details.diskSpace.required} MB required`;
          }
          
          Alert.alert(
            'System Requirements Warning',
            warningMessage,
            [{ text: 'OK', style: 'default' }]
          );
        }
      } catch (error) {
        console.error('Error checking system requirements:', error);
      }
    };
    
    checkResources();
  }, [resources]);

  // Update container config when any selection changes
  useEffect(() => {
    const config: ContainerConfig = {
      os: selectedOS,
      architecture: selectedArchitecture,
      version: selectedVersion,
      resources: resources
    };
    
    if (selectedOS === 'linux') {
      config.distribution = linuxDistribution;
    }
    
    onConfigChange(config);
  }, [selectedOS, selectedArchitecture, selectedVersion, linuxDistribution, resources]);

  // Update available versions based on selected OS and architecture
  const updateAvailableVersions = () => {
    let versions: string[] = [];
    
    switch (selectedOS) {
      case 'windows':
        versions = getAvailableWindowsVersions(selectedArchitecture);
        if (versions.length > 0 && !versions.includes(selectedVersion)) {
          setSelectedVersion(versions[0]);
        }
        break;
      case 'linux':
        versions = getAvailableLinuxVersions(selectedArchitecture);
        if (versions.length > 0 && !versions.includes(selectedVersion)) {
          // Find a version for the current distribution
          const distroVersions = versions.filter(v => v.startsWith(linuxDistribution));
          setSelectedVersion(distroVersions.length > 0 ? distroVersions[0] : versions[0]);
        }
        break;
      case 'macos':
        versions = getAvailableMacOSVersions(selectedArchitecture);
        if (versions.length > 0 && !versions.includes(selectedVersion)) {
          setSelectedVersion(versions[0]);
        }
        break;
    }
    
    setAvailableVersions(versions);
  };

  // Handle resource preset change
  const handleResourcePresetChange = (preset: ResourcePresetType) => {
    setResourcePreset(preset);
    
    if (preset !== 'custom') {
      setResources(getResourcePreset(preset, selectedOS));
    }
  };

  // Handle custom resource change
  const handleResourceChange = (key: keyof ContainerResourceLimits, value: number) => {
    setResourcePreset('custom');
    setResources(prev => ({ ...prev, [key]: value }));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Collapsible 
          title="Operating System" 
          value={selectedOS.charAt(0).toUpperCase() + selectedOS.slice(1)}
        >
          <View style={[styles.pickerContainer, { borderColor }]}>
            <Picker
              selectedValue={selectedOS}
              onValueChange={(value: string) => setSelectedOS(value as OSType)}
              style={[styles.picker, { color: '#000000' }]}
              dropdownIconColor="#333333"
            >
              <Picker.Item label="Windows" value="windows" color="#000000" />
              <Picker.Item label="Linux" value="linux" color="#000000" />
              <Picker.Item label="macOS" value="macos" color="#000000" />
            </Picker>
          </View>
        </Collapsible>
        
        <Collapsible 
          title="Architecture" 
          value={selectedArchitecture === 'x64' ? 'x64 (64-bit)' : 
                 selectedArchitecture === 'x86' ? 'x86 (32-bit)' : 
                 selectedArchitecture === 'arm64' ? 'ARM64' : 'ARM'}
        >
          <View style={[styles.pickerContainer, { borderColor }]}>
            <Picker
              selectedValue={selectedArchitecture}
              onValueChange={(value: string) => setSelectedArchitecture(value as ArchitectureType)}
              style={[styles.picker, { color: '#000000' }]}
              dropdownIconColor="#333333"
            >
              <Picker.Item label="x86 (32-bit)" value="x86" color="#000000" />
              <Picker.Item label="x64 (64-bit)" value="x64" color="#000000" />
              <Picker.Item label="ARM" value="arm" color="#000000" />
              <Picker.Item label="ARM64" value="arm64" color="#000000" />
            </Picker>
          </View>
        </Collapsible>
        
        {selectedOS === 'linux' && (
          <Collapsible 
            title="Linux Distribution" 
            value={linuxDistribution.charAt(0).toUpperCase() + linuxDistribution.slice(1)}
          >
            <View style={[styles.pickerContainer, { borderColor }]}>
              <Picker
                selectedValue={linuxDistribution}
                onValueChange={(value: string) => {
                  setLinuxDistribution(value);
                  // Update version to match the new distribution
                  const distroVersions = availableVersions.filter(v => v.startsWith(value));
                  if (distroVersions.length > 0) {
                    setSelectedVersion(distroVersions[0]);
                  }
                }}
                style={[styles.picker, { color: '#000000' }]}
                dropdownIconColor="#333333"
              >
                {availableDistributions.map((distro) => (
                  <Picker.Item key={distro} label={distro.charAt(0).toUpperCase() + distro.slice(1)} value={distro} color="#000000" />
                ))}
              </Picker>
            </View>
          </Collapsible>
        )}
        
        <Collapsible 
          title={
            selectedOS === 'windows' ? 'Windows Version' : 
            selectedOS === 'linux' ? 'Linux Version' : 'macOS Version'
          }
          value={
            selectedOS === 'windows' ? selectedVersion.replace('windows-', 'Windows ') :
            selectedOS === 'linux' ? (() => {
              const parts = selectedVersion.split('-');
              const distro = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              return `${distro} ${parts[1]}`;
            })() :
            (() => {
              const versionNumber = selectedVersion.replace('macos-', '');
              const versionNames: Record<string, string> = {
                '11': 'Big Sur',
                '12': 'Monterey',
                '13': 'Ventura',
                '14': 'Sonoma'
              };
              return `macOS ${versionNumber} (${versionNames[versionNumber] || ''})`;
            })()
          }
        >
          <View style={[styles.pickerContainer, { borderColor }]}>
            <Picker
              selectedValue={selectedVersion}
              onValueChange={(value: string) => setSelectedVersion(value)}
              style={[styles.picker, { color: '#000000' }]}
              dropdownIconColor="#333333"
            >
              {availableVersions.map((version) => {
                let label = version;
                
                // Format the version label
                if (selectedOS === 'windows') {
                  label = version.replace('windows-', 'Windows ');
                } else if (selectedOS === 'linux') {
                  const parts = version.split('-');
                  const distro = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                  label = `${distro} ${parts[1]}`;
                } else if (selectedOS === 'macos') {
                  const versionNumber = version.replace('macos-', '');
                  const versionNames: Record<string, string> = {
                    '11': 'Big Sur',
                    '12': 'Monterey',
                    '13': 'Ventura',
                    '14': 'Sonoma'
                  };
                  label = `macOS ${versionNumber} (${versionNames[versionNumber] || ''})`;
                }
                
                return <Picker.Item key={version} label={label} value={version} color="#000000" />;
              })}
            </Picker>
          </View>
        </Collapsible>
        
        <Collapsible 
          title="Resource Configuration" 
          value={resourcePreset.charAt(0).toUpperCase() + resourcePreset.slice(1)}
        >
          <View style={[styles.pickerContainer, { borderColor }]}>
            <Picker
              selectedValue={resourcePreset}
              onValueChange={(value: string) => handleResourcePresetChange(value as ResourcePresetType)}
              style={[styles.picker, { color: '#000000' }]}
              dropdownIconColor="#333333"
            >
              <Picker.Item label="Minimal" value="minimal" color="#000000" />
              <Picker.Item label="Standard" value="standard" color="#000000" />
              <Picker.Item label="Performance" value="performance" color="#000000" />
              <Picker.Item label="Intensive" value="intensive" color="#000000" />
              <Picker.Item label="Custom" value="custom" color="#000000" />
            </Picker>
          </View>
          
          {resourcePreset === 'custom' && (
            <View style={styles.resourcesSection}>
              <ThemedText style={styles.resourceTitle}>CPU Cores: {resources.cpu}</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={8}
                step={0.5}
                value={resources.cpu || 1}
                onValueChange={(value: number) => handleResourceChange('cpu', value)}
                minimumTrackTintColor="#d06d86"
                maximumTrackTintColor="#FFFFFF"
                thumbTintColor="#4a90e2"
              />
              
              <ThemedText style={styles.resourceTitle}>Memory: {resources.memory} MB</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={512}
                maximumValue={16384}
                step={512}
                value={resources.memory || 2048}
                onValueChange={(value: number) => handleResourceChange('memory', value)}
                minimumTrackTintColor="#d06d86"
                maximumTrackTintColor="#FFFFFF"
                thumbTintColor="#4a90e2"
              />
              
              <ThemedText style={styles.resourceTitle}>Disk Space: {resources.diskSpace} MB</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1024}
                maximumValue={51200}
                step={1024}
                value={resources.diskSpace || 5120}
                onValueChange={(value: number) => handleResourceChange('diskSpace', value)}
                minimumTrackTintColor="#d06d86"
                maximumTrackTintColor="#FFFFFF"
                thumbTintColor="#4a90e2"
              />
              
              <ThemedText style={styles.resourceTitle}>Network Speed: {resources.networkSpeed} Mbps</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={200}
                step={1}
                value={resources.networkSpeed || 10}
                onValueChange={(value: number) => handleResourceChange('networkSpeed', value)}
                minimumTrackTintColor="#d06d86"
                maximumTrackTintColor="#FFFFFF"
                thumbTintColor="#4a90e2"
              />
              
              <ThemedText style={styles.resourceTitle}>I/O Operations: {resources.ioOperations} IOPS</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={100}
                maximumValue={20000}
                step={100}
                value={resources.ioOperations || 1000}
                onValueChange={(value: number) => handleResourceChange('ioOperations', value)}
                minimumTrackTintColor="#d06d86"
                maximumTrackTintColor="#FFFFFF"
                thumbTintColor="#4a90e2"
              />
            </View>
          )}
        </Collapsible>
        
        <View style={styles.summarySection}>
          <ThemedText style={styles.sectionTitle}>Container Configuration Summary</ThemedText>
          <ThemedView style={[styles.summaryBox, { borderColor }]}>
            <ThemedText style={styles.summaryText}>OS: <ThemedText style={styles.summaryValue}>{selectedOS.charAt(0).toUpperCase() + selectedOS.slice(1)}</ThemedText></ThemedText>
            <ThemedText style={styles.summaryText}>Architecture: <ThemedText style={styles.summaryValue}>{selectedArchitecture}</ThemedText></ThemedText>
            <ThemedText style={styles.summaryText}>Version: <ThemedText style={styles.summaryValue}>{selectedVersion}</ThemedText></ThemedText>
            {selectedOS === 'linux' && <ThemedText style={styles.summaryText}>Distribution: <ThemedText style={styles.summaryValue}>{linuxDistribution}</ThemedText></ThemedText>}
            <ThemedText style={styles.summaryText}>Resource Preset: <ThemedText style={styles.summaryValue}>{resourcePreset}</ThemedText></ThemedText>
            <ThemedText style={styles.summaryText}>CPU: <ThemedText style={styles.summaryValue}>{resources.cpu} cores</ThemedText>{systemRequirements && !systemRequirements.details.cpu.meets && <ThemedText style={styles.warningText}> ⚠️</ThemedText>}</ThemedText>
            <ThemedText style={styles.summaryText}>Memory: <ThemedText style={styles.summaryValue}>{resources.memory} MB</ThemedText>{systemRequirements && !systemRequirements.details.memory.meets && <ThemedText style={styles.warningText}> ⚠️</ThemedText>}</ThemedText>
            <ThemedText style={styles.summaryText}>Disk Space: <ThemedText style={styles.summaryValue}>{resources.diskSpace} MB</ThemedText>{systemRequirements && !systemRequirements.details.diskSpace.meets && <ThemedText style={styles.warningText}> ⚠️</ThemedText>}</ThemedText>
            <ThemedText style={styles.summaryText}>Network Speed: <ThemedText style={styles.summaryValue}>{resources.networkSpeed} Mbps</ThemedText></ThemedText>
            <ThemedText style={styles.summaryText}>I/O Operations: <ThemedText style={styles.summaryValue}>{resources.ioOperations} IOPS</ThemedText></ThemedText>
            
            {systemRequirements && (
              <View style={[styles.systemRequirementsBox, { backgroundColor: systemRequirements.meetsRequirements ? '#e6ffe6' : '#ffe6e6' }]}>
                <ThemedText style={[styles.systemRequirementsText, { color: systemRequirements.meetsRequirements ? '#006600' : '#cc0000' }]}>
                  {systemRequirements.meetsRequirements 
                    ? '✓ Your system meets the requirements for this container configuration.' 
                    : '⚠️ Your system does not meet all requirements for this container configuration.'}
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffd1dd',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#ffecf1',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#000000',
    fontWeight: 'bold',
  },
  resourcesSection: {
    marginTop: 8,
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#ffecf1',
    borderRadius: 8,
  },
  resourceTitle: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
    color: '#000',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  summarySection: {
    marginTop: 16,
    marginBottom: 32,
  },
  summaryBox: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  warningText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#cc0000',
  },
  systemRequirementsBox: {
    marginTop: 16,
    padding: 10,
    borderRadius: 8,
  },
  systemRequirementsText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ContainerConfigSelector;
