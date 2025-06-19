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

// Import for convenience token object
import { colors as importedColors } from './colors';
import { spacing as importedSpacing } from './spacing';
import { 
  fontFamilies as importedFontFamilies,
  fontWeights as importedFontWeights,
  fontSizes as importedFontSizes,
  lineHeights as importedLineHeights,
  letterSpacing as importedLetterSpacing,
  textStyles as importedTextStyles
} from './typography';
import { shadows as importedShadows } from './shadows';

// Convenience token object for easier imports
export const tokens = {
  colors: importedColors,
  spacing: importedSpacing,
  typography: {
    fontFamilies: importedFontFamilies,
    fontWeights: importedFontWeights,
    fontSizes: importedFontSizes,
    lineHeights: importedLineHeights,
    letterSpacing: importedLetterSpacing,
    textStyles: importedTextStyles,
  },
  shadows: importedShadows,
} as const;