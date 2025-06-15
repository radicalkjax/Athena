import React from 'react';
import { View, Text } from 'react-native';
import HomeScreen from './app/(tabs)/index';

export default function App() {
  // Temporarily bypass expo-router to test if components work
  console.log('App.tsx loaded - testing direct component rendering');
  
  try {
    return <HomeScreen />;
  } catch (error) {
    console.error('Error loading HomeScreen:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading app: {error.message}</Text>
      </View>
    );
  }
}