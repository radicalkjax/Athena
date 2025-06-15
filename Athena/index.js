import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// This is the entry point for expo-router
const App = () => {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
};

registerRootComponent(App);