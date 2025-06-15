import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './app/(tabs)/index';
import AboutScreen from './app/(tabs)/about';
import SettingsScreen from './app/(tabs)/settings';
import { IconSymbol } from './components/ui/IconSymbol';
import { Colors } from './constants/Colors';
import { useColorScheme } from './hooks';
import { ErrorBoundary } from './shared/error-handling';
import { initializeAIModels } from './services/initializeModels';

const Tab = createBottomTabNavigator();

function AppContent() {
  const colorScheme = useColorScheme();
  
  useEffect(() => {
    // Initialize AI models when app starts
    initializeAIModels();
  }, []);
  
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].background,
          },
        }}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tab.Screen
          name="About"
          component={AboutScreen}
          options={{
            title: 'About',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="info.circle.fill" color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  console.log('App.tsx loaded - using direct navigation setup');
  
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}