import { StyleSheet, View } from 'react-native';
import { Platform } from 'react-native';

export default function TabBarBackground() {
  // Use a simple background for web instead of BlurView
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
          }
        ]}
      />
    );
  }

  // For native platforms, try to use BlurView if available
  try {
    const { BlurView } = require('expo-blur');
    return (
      <BlurView
        tint="systemMaterial"
        intensity={100}
        style={StyleSheet.absoluteFill}
      />
    );
  } catch (error) {
    // Fallback to simple background if BlurView is not available
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          }
        ]}
      />
    );
  }
}
