/**
 * Input component for Athena design system
 * A simple, accessible text input component with consistent styling
 */

import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, fontSizes } from '../tokens';

// Input variants
export type InputVariant = 'default' | 'filled' | 'error' | 'success';

// Input sizes
export type InputSize = 'small' | 'medium' | 'large';

// Input props
export interface InputProps extends Omit<TextInputProps, 'style'> {
  variant?: InputVariant;
  size?: InputSize;
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  helperStyle?: StyleProp<TextStyle>;
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  size = 'medium',
  label,
  error,
  helperText,
  containerStyle,
  style,
  labelStyle,
  errorStyle,
  helperStyle,
  editable = true,
  ...props
}) => {
  // Determine variant based on error state
  const actualVariant = error ? 'error' : variant;

  // Input styles
  const inputStyles = [
    styles.input,
    styles[`input_${actualVariant}`],
    styles[`input_${size}`],
    !editable && styles.input_disabled,
    style,
  ];

  // Container styles
  const containerStyles = [
    styles.container,
    containerStyle,
  ];

  return (
    <View style={containerStyles}>
      {label && (
        <Text style={[styles.label, styles[`label_${size}`], labelStyle]}>
          {label}
        </Text>
      )}
      
      <TextInput
        style={inputStyles}
        editable={editable}
        placeholderTextColor="#AAAAAA"
        {...props}
      />
      
      {error && (
        <Text style={[styles.error, errorStyle]}>
          {error}
        </Text>
      )}
      
      {helperText && !error && (
        <Text style={[styles.helper, helperStyle]}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Container
  container: {
    marginBottom: spacing.md,
  },

  // Label styles
  label: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#000000',
    marginBottom: spacing.sm,
  },
  label_small: {
    fontSize: 14,
  },
  label_medium: {
    fontSize: 16,
  },
  label_large: {
    fontSize: 18,
  },

  // Input base styles
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    fontSize: 16,
    color: '#000000',
  },

  // Input variants
  input_default: {
    borderColor: '#DDDDDD',
  },
  input_filled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  input_error: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  input_success: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  input_disabled: {
    backgroundColor: '#F0F0F0',
    color: '#999999',
  },

  // Input sizes
  input_small: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  input_medium: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
  },
  input_large: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 18,
  },

  // Error text
  error: {
    fontSize: 14,
    color: '#FF6B6B',
    marginTop: spacing.xs,
  },

  // Helper text
  helper: {
    fontSize: 14,
    color: '#666666',
    marginTop: spacing.xs,
    opacity: 0.7,
  },
});

// Export input component as default
export default Input;