import React from 'react';
import { View } from 'react-native';
import { ContainerConfig, ContainerResourceLimits } from '@/types';

interface ContainerConfigSelectorProps {
  initialConfig?: ContainerConfig;
  onConfigChange: (config: ContainerConfig) => void;
  disabled?: boolean;
}

// Mock ContainerConfigSelector component
export const ContainerConfigSelector: React.FC<ContainerConfigSelectorProps> = ({ 
  initialConfig, 
  onConfigChange, 
  disabled = false 
}) => {
  return React.createElement(View, {
    testID: 'container-config-selector',
    'data-disabled': disabled,
    'data-initial-config': JSON.stringify(initialConfig)
  });
};

export default ContainerConfigSelector;