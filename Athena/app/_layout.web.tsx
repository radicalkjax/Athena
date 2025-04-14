import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StyleSheet } from 'react-native';

// Import global CSS for web
import '../assets/global.css';

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Force Roboto font for web
if (typeof document !== 'undefined') {
  // Create a style element
  const style = document.createElement('style');
  style.textContent = `
    * {
      font-family: 'Roboto', sans-serif !important;
    }
    
    .r-fontFamily-1qd0xha {
      font-family: 'Roboto', sans-serif !important;
    }
    
    div[dir="auto"] {
      font-family: 'Roboto', sans-serif !important;
    }
  `;
  
  // Append the style element to the head
  document.head.appendChild(style);
  
  // Create a link element for Google Fonts
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
  
  // Append the link element to the head
  document.head.appendChild(link);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'SpaceMono': require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Roboto': require('../assets/fonts/Roboto/Roboto-Regular.ttf'),
    'Roboto-Light': require('../assets/fonts/Roboto/Roboto-Light.ttf'),
    'Roboto-Medium': require('../assets/fonts/Roboto/Roboto-Medium.ttf'),
    'Roboto-Bold': require('../assets/fonts/Roboto/Roboto-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// Add global styles to override font family
StyleSheet.create({
  text: {
    fontFamily: 'Roboto',
  },
});
