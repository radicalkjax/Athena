// Mock for expo
export const registerRootComponent = () => {};
export const AppLoading = 'AppLoading';
export const SplashScreen = {
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
};

export default {
  registerRootComponent,
  AppLoading,
  SplashScreen,
};