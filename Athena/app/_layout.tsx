import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks';
import { ErrorBoundary } from '@/shared/error-handling';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create custom themes with proper font configuration
const CustomDefaultTheme = {
  ...DefaultTheme,
  fonts: {
    regular: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '900' as const,
    },
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  fonts: {
    regular: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '900' as const,
    },
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // For web, fonts are loaded via CSS, so we can immediately hide splash screen
    // For native platforms, we'll need to implement font loading separately if needed
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // Ignore splash screen errors
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
