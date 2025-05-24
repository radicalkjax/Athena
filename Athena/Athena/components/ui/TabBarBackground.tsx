import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function TabBarBackground() {
  return (
    <BlurView
      tint="systemMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}
