/**
 * Color tokens for Athena design system
 * Includes semantic colors for malware threat levels
 */

export const colors = {
  // Brand colors
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },

  // Neutral colors
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  // Semantic colors
  semantic: {
    error: {
      light: '#ff5252',
      main: '#f44336',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      light: '#ffb74d',
      main: '#ff9800',
      dark: '#f57c00',
      contrastText: '#000000',
    },
    success: {
      light: '#81c784',
      main: '#4caf50',
      dark: '#388e3c',
      contrastText: '#ffffff',
    },
    info: {
      light: '#64b5f6',
      main: '#2196f3',
      dark: '#1976d2',
      contrastText: '#ffffff',
    },
  },

  // Malware threat levels
  threat: {
    none: {
      light: '#e8f5e9',
      main: '#4caf50',
      dark: '#2e7d32',
      contrastText: '#ffffff',
    },
    low: {
      light: '#fff9c4',
      main: '#ffeb3b',
      dark: '#f9a825',
      contrastText: '#000000',
    },
    medium: {
      light: '#ffe0b2',
      main: '#ff9800',
      dark: '#e65100',
      contrastText: '#000000',
    },
    high: {
      light: '#ffccbc',
      main: '#ff5722',
      dark: '#bf360c',
      contrastText: '#ffffff',
    },
    critical: {
      light: '#ffcdd2',
      main: '#f44336',
      dark: '#b71c1c',
      contrastText: '#ffffff',
    },
  },

  // Background colors
  background: {
    default: '#ffffff',
    paper: '#f5f5f5',
    dark: '#121212',
    darkPaper: '#1e1e1e',
  },

  // Text colors
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
    hint: 'rgba(0, 0, 0, 0.38)',
    primaryDark: 'rgba(255, 255, 255, 0.87)',
    secondaryDark: 'rgba(255, 255, 255, 0.6)',
    disabledDark: 'rgba(255, 255, 255, 0.38)',
    hintDark: 'rgba(255, 255, 255, 0.38)',
  },

  // Action colors
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    activeDark: 'rgba(255, 255, 255, 0.54)',
    hoverDark: 'rgba(255, 255, 255, 0.04)',
    selectedDark: 'rgba(255, 255, 255, 0.08)',
    disabledDark: 'rgba(255, 255, 255, 0.26)',
    disabledBackgroundDark: 'rgba(255, 255, 255, 0.12)',
  },

  // Divider colors
  divider: 'rgba(0, 0, 0, 0.12)',
  dividerDark: 'rgba(255, 255, 255, 0.12)',

  // Special colors for malware analysis
  analysis: {
    deobfuscated: '#00bcd4',
    obfuscated: '#9c27b0',
    vulnerable: '#ff5252',
    secure: '#4caf50',
    scanning: '#2196f3',
    pending: '#9e9e9e',
  },

  // Container status colors
  containerStatus: {
    creating: '#2196f3',
    running: '#4caf50',
    stopped: '#ff9800',
    error: '#f44336',
    destroyed: '#9e9e9e',
  },
} as const;

// Type helpers
export type ColorToken = typeof colors;
export type ThemeMode = 'light' | 'dark';

// Helper function to get color based on theme
export const getColor = (
  colorPath: string,
  theme: ThemeMode = 'light'
): string => {
  const paths = colorPath.split('.');
  let value: any = colors;
  
  for (const path of paths) {
    value = value[path];
    if (!value) {
      console.warn(`Color path not found: ${colorPath}`);
      return theme === 'dark' ? colors.neutral[900] : colors.neutral[100];
    }
  }
  
  return value;
};

// Helper function to get threat color based on severity
export const getThreatColor = (severity: 'none' | 'low' | 'medium' | 'high' | 'critical') => {
  return colors.threat[severity] || colors.threat.none;
};

// Helper function to get container status color
export const getContainerStatusColor = (status: keyof typeof colors.containerStatus) => {
  return colors.containerStatus[status] || colors.containerStatus.creating;
};