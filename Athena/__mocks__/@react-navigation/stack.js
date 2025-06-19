import { vi } from 'vitest';

export const createStackNavigator = () => ({
  Navigator: ({ children }) => children,
  Screen: ({ children }) => children,
  Group: ({ children }) => children
});

export const CardStyleInterpolators = {
  forHorizontalIOS: {},
  forVerticalIOS: {},
  forModalPresentationIOS: {},
  forFadeFromBottomAndroid: {},
  forRevealFromBottomAndroid: {},
  forScaleFromCenterAndroid: {},
  forNoAnimation: {}
};

export const HeaderStyleInterpolators = {
  forUIKit: {},
  forFade: {},
  forStatic: {}
};

export const TransitionIOSSpec = {};
export const FadeInFromBottomAndroidSpec = {};
export const FadeOutToBottomAndroidSpec = {};
export const RevealFromBottomAndroidSpec = {};

export const gestureHandlerRootHOC = (component) => component;

export const useHeaderHeight = () => 56;