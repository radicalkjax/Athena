/**
 * Mock for @react-native-picker/picker
 * Fixes Flow syntax issues in testing environment
 */

import React from 'react';
import { View, Text } from 'react-native';

// Mock Picker component
export const Picker = React.forwardRef((props, ref) => {
  const { children, onValueChange, selectedValue, testID, style, mode, enabled = true, ...otherProps } = props;
  
  // Mock picker that renders as a View with testable children
  return React.createElement(
    View,
    {
      ref,
      testID: testID || 'picker',
      style,
      ...otherProps
    },
    React.Children.map(children, (child, index) => {
      if (!child || !child.props) return null;
      
      const isSelected = child.props.value === selectedValue;
      
      return React.createElement(
        Text,
        {
          key: child.props.value || index,
          testID: isSelected ? `${testID}-selected` : `${testID}-option-${child.props.value}`,
          onPress: enabled && onValueChange 
            ? () => onValueChange(child.props.value, index)
            : undefined,
          style: {
            padding: 8,
            backgroundColor: isSelected ? '#e0e0e0' : 'transparent',
            color: child.props.color || '#000'
          }
        },
        child.props.label
      );
    })
  );
});

// Mock Picker.Item component
const PickerItem = React.forwardRef((props, ref) => {
  const { label, value, color, testID, style, ...otherProps } = props;
  
  // Item doesn't render anything directly, it's handled by parent Picker
  return null;
});

// Add static properties
Picker.MODE_DIALOG = 'dialog';
Picker.MODE_DROPDOWN = 'dropdown';

// Attach Item to Picker
Picker.Item = PickerItem;

// Default export
export default Picker;

// Named exports for compatibility
export { Picker };