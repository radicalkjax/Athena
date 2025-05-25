/**
 * Shadow tokens for Athena design system
 * Provides elevation system for depth perception
 */

import { Platform } from 'react-native';

// Shadow definitions for different platforms
const createShadow = (elevation: number) => {
  if (Platform.OS === 'web') {
    // Web shadows using box-shadow
    const shadows = {
      0: 'none',
      1: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
      2: '0px 3px 6px rgba(0, 0, 0, 0.16), 0px 3px 6px rgba(0, 0, 0, 0.23)',
      3: '0px 10px 20px rgba(0, 0, 0, 0.19), 0px 6px 6px rgba(0, 0, 0, 0.23)',
      4: '0px 14px 28px rgba(0, 0, 0, 0.25), 0px 10px 10px rgba(0, 0, 0, 0.22)',
      5: '0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)',
    };
    return shadows[elevation as keyof typeof shadows] || shadows[0];
  }
  
  if (Platform.OS === 'ios') {
    // iOS shadow properties
    return {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: elevation,
      },
      shadowOpacity: 0.15 + (elevation * 0.02),
      shadowRadius: elevation * 1.5,
    };
  }
  
  if (Platform.OS === 'android') {
    // Android uses elevation prop directly
    return {
      elevation: elevation,
    };
  }
  
  return {};
};

// Shadow levels
export const shadows = {
  none: createShadow(0),
  xs: createShadow(1),
  sm: createShadow(2),
  md: createShadow(3),
  lg: createShadow(4),
  xl: createShadow(5),
  
  // Numeric scale
  0: createShadow(0),
  1: createShadow(1),
  2: createShadow(2),
  3: createShadow(3),
  4: createShadow(4),
  5: createShadow(5),
  6: createShadow(6),
  8: createShadow(8),
  10: createShadow(10),
  12: createShadow(12),
  16: createShadow(16),
  24: createShadow(24),
} as const;

// Component-specific shadows
export const componentShadows = {
  card: {
    default: shadows.sm,
    hover: shadows.md,
    active: shadows.xs,
  },
  button: {
    default: shadows.xs,
    hover: shadows.sm,
    active: shadows.none,
    floating: shadows.lg,
  },
  modal: {
    default: shadows.xl,
  },
  dropdown: {
    default: shadows.md,
  },
  tooltip: {
    default: shadows.sm,
  },
  appBar: {
    default: shadows.md,
  },
  drawer: {
    default: shadows.lg,
  },
} as const;

// Dark mode shadow adjustments
export const darkShadows = {
  none: createShadow(0),
  xs: Platform.select({
    web: '0px 1px 3px rgba(255, 255, 255, 0.05), 0px 1px 2px rgba(255, 255, 255, 0.10)',
    default: createShadow(1),
  }),
  sm: Platform.select({
    web: '0px 3px 6px rgba(255, 255, 255, 0.08), 0px 3px 6px rgba(255, 255, 255, 0.12)',
    default: createShadow(2),
  }),
  md: Platform.select({
    web: '0px 10px 20px rgba(255, 255, 255, 0.10), 0px 6px 6px rgba(255, 255, 255, 0.12)',
    default: createShadow(3),
  }),
  lg: Platform.select({
    web: '0px 14px 28px rgba(255, 255, 255, 0.13), 0px 10px 10px rgba(255, 255, 255, 0.11)',
    default: createShadow(4),
  }),
  xl: Platform.select({
    web: '0px 19px 38px rgba(255, 255, 255, 0.15), 0px 15px 12px rgba(255, 255, 255, 0.11)',
    default: createShadow(5),
  }),
} as const;

// Inner shadows (for pressed states, inputs, etc.)
export const innerShadows = {
  sm: Platform.select({
    web: 'inset 0px 1px 2px rgba(0, 0, 0, 0.15)',
    default: {},
  }),
  md: Platform.select({
    web: 'inset 0px 2px 4px rgba(0, 0, 0, 0.20)',
    default: {},
  }),
  lg: Platform.select({
    web: 'inset 0px 3px 6px rgba(0, 0, 0, 0.25)',
    default: {},
  }),
} as const;

// Type helpers
export type ShadowLevel = keyof typeof shadows;
export type ComponentShadow = keyof typeof componentShadows;

// Helper functions
export const getShadow = (level: ShadowLevel = 'none', isDark: boolean = false) => {
  if (isDark && Platform.OS === 'web') {
    return darkShadows[level as keyof typeof darkShadows] || darkShadows.none;
  }
  return shadows[level] || shadows.none;
};

export const getComponentShadow = (
  component: ComponentShadow,
  state: 'default' | 'hover' | 'active' | 'floating' = 'default',
  isDark: boolean = false
) => {
  const componentShadow = componentShadows[component];
  const shadowLevel = componentShadow[state as keyof typeof componentShadow] || componentShadow.default;
  
  if (isDark && Platform.OS === 'web') {
    // Map the shadow object to find its level
    const shadowLevelKey = Object.entries(shadows).find(
      ([_, value]) => value === shadowLevel
    )?.[0] as keyof typeof darkShadows;
    
    return darkShadows[shadowLevelKey] || darkShadows.none;
  }
  
  return shadowLevel;
};

// Elevation to shadow mapping for Android compatibility
export const elevationToShadow = (elevation: number): any => {
  return createShadow(elevation);
};

// Box shadow string builder for web
export const buildBoxShadow = (
  offsetX: number = 0,
  offsetY: number = 2,
  blurRadius: number = 4,
  spreadRadius: number = 0,
  color: string = 'rgba(0, 0, 0, 0.15)'
): string => {
  if (Platform.OS !== 'web') {
    console.warn('buildBoxShadow is only supported on web platform');
    return '';
  }
  return `${offsetX}px ${offsetY}px ${blurRadius}px ${spreadRadius}px ${color}`;
};