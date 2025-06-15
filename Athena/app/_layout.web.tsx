import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

// Import global CSS for web
import '../assets/global.css';
// Import polyfills for web compatibility
import '../polyfills';

import { useColorScheme } from '@/hooks';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Simple font loading for web with error handling
if (typeof document !== 'undefined') {
  // Load Google Fonts as fallback only if local fonts fail
  const googleFontsLink = document.createElement('link');
  googleFontsLink.rel = 'stylesheet';
  googleFontsLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
  googleFontsLink.onerror = () => {
    console.warn('Failed to load Google Fonts, using system fonts as fallback');
  };
  
  // Only load Google Fonts if local fonts are not available
  // Check if Roboto font is available, if not load from Google Fonts
  if (document.fonts && document.fonts.check) {
    try {
      if (!document.fonts.check('1em Roboto')) {
        document.head.appendChild(googleFontsLink);
      }
    } catch (error) {
      console.warn('Font check failed, loading Google Fonts as fallback:', error);
      document.head.appendChild(googleFontsLink);
    }
  } else {
    // Fallback for browsers without font API support
    document.head.appendChild(googleFontsLink);
  }
}

// Create custom themes with proper font configuration
const CustomDefaultTheme = {
  ...DefaultTheme,
  fonts: {
    regular: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '900' as const,
    },
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  fonts: {
    regular: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontWeight: '900' as const,
    },
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen after fonts are ready or timeout
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // Ignore splash screen errors
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
