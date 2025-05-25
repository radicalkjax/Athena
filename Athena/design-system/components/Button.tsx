/**
 * Button component for Athena design system
 * A simple, accessible button with multiple variants and sizes
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, fontSizes } from '../tokens';

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost' | 'link';

// Button sizes
export type ButtonSize = 'small' | 'medium' | 'large';

// Button props
export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  startIcon,
  endIcon,
  onPress,
  ...props
}) => {
  // Determine if button is disabled (either by prop or loading state)
  const isDisabled = disabled || loading;

  // Get button styles based on variant and size
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    isDisabled && styles[`${variant}Disabled` as keyof typeof styles],
    style,
  ];

  // Get text styles based on variant and size
  const textStyles = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles],
    styles[`${size}Text` as keyof typeof styles],
    isDisabled && styles.disabledText,
    textStyle,
  ];

  // Get loading indicator color
  const loadingColor = variant === 'primary' || variant === 'danger' 
    ? colors.neutral[0] 
    : colors.primary[500];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'small'} 
          color={loadingColor} 
        />
      ) : (
        <View style={styles.content}>
          {startIcon && <View style={styles.startIcon}>{startIcon}</View>}
          <Text style={textStyles} numberOfLines={1}>
            {children}
          </Text>
          {endIcon && <View style={styles.endIcon}>{endIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Base styles
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    color: colors.text.disabled,
  },
  startIcon: {
    marginRight: spacing.sm,
  },
  endIcon: {
    marginLeft: spacing.sm,
  },

  // Variant styles
  primary: {
    backgroundColor: '#4CAF50',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  primaryDisabled: {
    backgroundColor: '#81C784',
  },

  secondary: {
    backgroundColor: '#FF6B6B',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  secondaryDisabled: {
    backgroundColor: '#FFABAB',
  },

  tertiary: {
    backgroundColor: '#4A90E2',
  },
  tertiaryText: {
    color: '#FFFFFF',
  },
  tertiaryDisabled: {
    backgroundColor: '#85B8E8',
  },

  danger: {
    backgroundColor: colors.semantic.error.main,
  },
  dangerText: {
    color: colors.neutral[0],
  },
  dangerDisabled: {
    backgroundColor: colors.semantic.error.light,
  },

  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.primary[500],
  },
  ghostDisabled: {
    backgroundColor: 'transparent',
  },

  link: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  linkText: {
    color: colors.primary[500],
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    backgroundColor: 'transparent',
  },

  // Size styles
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 24,
  },
  smallText: {
    fontSize: 12,
    fontWeight: 'bold' as const,
  },

  medium: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 40,
  },
  mediumText: {
    fontSize: fontSizes.button.md,
  },

  large: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 48,
  },
  largeText: {
    fontSize: fontSizes.button.lg,
  },
});

// Export button component as default
export default Button;