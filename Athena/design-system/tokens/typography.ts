/**
 * Typography tokens for Athena design system
 * Includes font families, sizes, weights, and line heights
 */

import { Platform } from 'react-native';

// Font families
export const fontFamilies = {
  // Primary font family
  primary: Platform.select({
    web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  
  // Monospace font for code
  mono: Platform.select({
    web: '"Roboto Mono", "SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
  
  // Display font for headings (optional)
  display: Platform.select({
    web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
};

// Font weights
export const fontWeights = {
  thin: '100' as const,
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '900' as const,
} as const;

// Font sizes
export const fontSizes = {
  // Base sizes
  xxs: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  
  // Heading sizes
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,
  
  // Component-specific sizes
  button: {
    sm: 14,
    md: 16,
    lg: 18,
  },
  input: {
    sm: 14,
    md: 16,
    lg: 18,
  },
  label: {
    sm: 12,
    md: 14,
    lg: 16,
  },
  caption: 12,
  overline: 10,
} as const;

// Line heights
export const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
  
  // Component-specific line heights
  heading: 1.2,
  body: 1.5,
  button: 1.25,
  input: 1.5,
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: -0.05,
  tight: -0.025,
  normal: 0,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
} as const;

// Text styles (combinations)
export const textStyles = {
  h1: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h1,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h2,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h3,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.normal,
  },
  h4: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h4,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.normal,
  },
  h5: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h5,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.normal,
  },
  h6: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.h6,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.heading,
    letterSpacing: letterSpacing.normal,
  },
  body1: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.body,
    letterSpacing: letterSpacing.normal,
  },
  body2: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.body,
    letterSpacing: letterSpacing.normal,
  },
  button: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.button.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.button,
    letterSpacing: letterSpacing.wide,
    textTransform: 'none' as const,
  },
  caption: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.overline,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
  code: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const;

// Type helpers
export type FontFamily = keyof typeof fontFamilies;
export type FontWeight = keyof typeof fontWeights;
export type FontSize = keyof typeof fontSizes | number;
export type LineHeight = keyof typeof lineHeights | number;
export type LetterSpacing = keyof typeof letterSpacing | number;
export type TextStyle = keyof typeof textStyles;

// Helper functions
export const getFontFamily = (family: FontFamily = 'primary') => {
  return fontFamilies[family] || fontFamilies.primary;
};

export const getFontWeight = (weight: FontWeight = 'regular') => {
  return fontWeights[weight] || fontWeights.regular;
};

export const getFontSize = (size: FontSize = 'md') => {
  if (typeof size === 'number') return size;
  return fontSizes[size as keyof typeof fontSizes] || fontSizes.md;
};

export const getLineHeight = (height: LineHeight = 'normal') => {
  if (typeof height === 'number') return height;
  return lineHeights[height as keyof typeof lineHeights] || lineHeights.normal;
};

export const getTextStyle = (style: TextStyle) => {
  return textStyles[style] || textStyles.body1;
};