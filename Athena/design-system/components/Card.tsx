/**
 * Card component for Athena design system
 * A simple, flexible container component for grouping related content
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../tokens';

// Card variants
export type CardVariant = 'elevated' | 'outlined' | 'filled';

// Card props
export interface CardProps extends ViewProps {
  variant?: CardVariant;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  children,
  style,
  padding = 'medium',
  margin = 'small',
  ...props
}) => {
  const cardStyles = [
    styles.base,
    styles[variant],
    styles[`padding_${padding}`],
    styles[`margin_${margin}`],
    style,
  ];

  return (
    <View style={cardStyles} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // Base styles
  base: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Variant styles
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  outlined: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  filled: {
    backgroundColor: '#F5F5F5',
  },

  // Padding styles
  padding_none: {
    padding: 0,
  },
  padding_small: {
    padding: spacing.sm,
  },
  padding_medium: {
    padding: spacing.md,
  },
  padding_large: {
    padding: spacing.lg,
  },

  // Margin styles
  margin_none: {
    margin: 0,
  },
  margin_small: {
    margin: spacing.sm,
  },
  margin_medium: {
    margin: spacing.md,
  },
  margin_large: {
    margin: spacing.lg,
  },
});

// Export card component as default
export default Card;