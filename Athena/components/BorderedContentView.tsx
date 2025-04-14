import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedView } from './ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BorderedContentViewProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function BorderedContentView({ children, style }: BorderedContentViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = colorScheme === 'light' ? '#e47a9c' : '#d06c86';
  
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.content, { backgroundColor }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  content: {
    borderRadius: 12,
    padding: 16,
  },
});
