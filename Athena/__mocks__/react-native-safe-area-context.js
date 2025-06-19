// Mock for react-native-safe-area-context
import React from 'react';

export const SafeAreaProvider = ({ children }) => children;
export const SafeAreaView = 'SafeAreaView';
export const SafeAreaConsumer = ({ children }) => children({ insets: { top: 0, right: 0, bottom: 0, left: 0 } });
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });

export const SafeAreaInsetsContext = React.createContext({
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
});

export default {
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaConsumer,
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaInsetsContext,
};