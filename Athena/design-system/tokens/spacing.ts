/**
 * Spacing tokens for Athena design system
 * Uses a consistent 4px base scale
 */

// Base unit
const BASE_UNIT = 4;

// Spacing scale using T-shirt sizes
export const spacing = {
  // Base values
  none: 0,
  xxs: BASE_UNIT * 0.5,  // 2px
  xs: BASE_UNIT * 1,     // 4px
  sm: BASE_UNIT * 2,     // 8px
  md: BASE_UNIT * 3,     // 12px
  lg: BASE_UNIT * 4,     // 16px
  xl: BASE_UNIT * 5,     // 20px
  xxl: BASE_UNIT * 6,    // 24px
  xxxl: BASE_UNIT * 8,   // 32px
  
  // Numeric scale for more granular control
  0: 0,
  1: BASE_UNIT * 0.25,   // 1px
  2: BASE_UNIT * 0.5,    // 2px
  4: BASE_UNIT * 1,      // 4px
  6: BASE_UNIT * 1.5,    // 6px
  8: BASE_UNIT * 2,      // 8px
  10: BASE_UNIT * 2.5,   // 10px
  12: BASE_UNIT * 3,     // 12px
  14: BASE_UNIT * 3.5,   // 14px
  16: BASE_UNIT * 4,     // 16px
  20: BASE_UNIT * 5,     // 20px
  24: BASE_UNIT * 6,     // 24px
  28: BASE_UNIT * 7,     // 28px
  32: BASE_UNIT * 8,     // 32px
  36: BASE_UNIT * 9,     // 36px
  40: BASE_UNIT * 10,    // 40px
  44: BASE_UNIT * 11,    // 44px
  48: BASE_UNIT * 12,    // 48px
  56: BASE_UNIT * 14,    // 56px
  64: BASE_UNIT * 16,    // 64px
  72: BASE_UNIT * 18,    // 72px
  80: BASE_UNIT * 20,    // 80px
  96: BASE_UNIT * 24,    // 96px
  
  // Component-specific spacing
  component: {
    padding: {
      button: {
        sm: BASE_UNIT * 2,     // 8px
        md: BASE_UNIT * 3,     // 12px
        lg: BASE_UNIT * 4,     // 16px
      },
      card: {
        sm: BASE_UNIT * 3,     // 12px
        md: BASE_UNIT * 4,     // 16px
        lg: BASE_UNIT * 6,     // 24px
      },
      input: {
        horizontal: BASE_UNIT * 3, // 12px
        vertical: BASE_UNIT * 2,   // 8px
      },
      modal: {
        sm: BASE_UNIT * 4,     // 16px
        md: BASE_UNIT * 6,     // 24px
        lg: BASE_UNIT * 8,     // 32px
      },
    },
    margin: {
      section: BASE_UNIT * 8,   // 32px
      element: BASE_UNIT * 4,   // 16px
      inline: BASE_UNIT * 2,    // 8px
    },
    gap: {
      xs: BASE_UNIT * 1,       // 4px
      sm: BASE_UNIT * 2,       // 8px
      md: BASE_UNIT * 3,       // 12px
      lg: BASE_UNIT * 4,       // 16px
      xl: BASE_UNIT * 6,       // 24px
    },
  },
  
  // Layout spacing
  layout: {
    containerPadding: {
      mobile: BASE_UNIT * 4,    // 16px
      tablet: BASE_UNIT * 6,    // 24px
      desktop: BASE_UNIT * 8,   // 32px
    },
    maxWidth: {
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
    gridGutter: {
      mobile: BASE_UNIT * 4,    // 16px
      tablet: BASE_UNIT * 6,    // 24px
      desktop: BASE_UNIT * 8,   // 32px
    },
  },
  
  // Border radius
  radius: {
    none: 0,
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    round: 9999,
  },
  
  // Icon sizes
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
} as const;

// Type helpers
export type SpacingToken = typeof spacing;
export type SpacingValue = number;

// Helper functions
export const getSpacing = (value: number): number => {
  return BASE_UNIT * value;
};

export const px = (value: number): string => {
  return `${value}px`;
};

// Convert spacing to rem (assuming 16px base font size)
export const rem = (value: number): string => {
  return `${value / 16}rem`;
};

// Margin/padding helpers
export const createSpacing = (...args: number[]): string => {
  return args.map(v => px(v)).join(' ');
};

// Responsive spacing helper
export const responsiveSpacing = (
  mobile: number,
  tablet?: number,
  desktop?: number
): {
  mobile: string;
  tablet: string;
  desktop: string;
} => {
  return {
    mobile: px(mobile),
    tablet: px(tablet ?? mobile),
    desktop: px(desktop ?? tablet ?? mobile),
  };
};