/**
 * Design tokens export
 * Central location for all design system tokens
 */

// Export all token modules with explicit imports to avoid circular dependencies
export { colors, getColor, getThreatColor, getContainerStatusColor } from './colors';
export type { ColorToken, ThemeMode } from './colors';

export { spacing, getSpacing, px, rem, createSpacing, responsiveSpacing } from './spacing';
export type { SpacingToken, SpacingValue } from './spacing';

export { 
  fontFamilies, 
  fontWeights, 
  fontSizes, 
  lineHeights, 
  letterSpacing, 
  textStyles,
  getFontFamily,
  getFontWeight,
  getFontSize,
  getLineHeight,
  getTextStyle
} from './typography';
export type { FontFamily, FontWeight, FontSize, LineHeight, LetterSpacing, TextStyle } from './typography';

export { 
  shadows, 
  componentShadows, 
  darkShadows, 
  innerShadows,
  getShadow,
  getComponentShadow,
  elevationToShadow,
  buildBoxShadow
} from './shadows';
export type { ShadowLevel, ComponentShadow } from './shadows';

// Convenience token object for easier imports
export const tokens = {
  colors: require('./colors').colors,
  spacing: require('./spacing').spacing,
  typography: {
    fontFamilies: require('./typography').fontFamilies,
    fontWeights: require('./typography').fontWeights,
    fontSizes: require('./typography').fontSizes,
    lineHeights: require('./typography').lineHeights,
    letterSpacing: require('./typography').letterSpacing,
    textStyles: require('./typography').textStyles,
  },
  shadows: require('./shadows').shadows,
} as const;