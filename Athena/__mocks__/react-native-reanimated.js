// Mock for react-native-reanimated
export const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  ScrollView: 'Animated.ScrollView',
  Image: 'Animated.Image',
  createAnimatedComponent: (component) => component,
};

export const Easing = {
  linear: () => {},
  ease: () => {},
  quad: () => {},
  cubic: () => {},
  poly: () => {},
  sin: () => {},
  circle: () => {},
  exp: () => {},
  elastic: () => {},
  back: () => {},
  bounce: () => {},
  bezier: () => {},
  in: () => {},
  out: () => {},
  inOut: () => {},
};

export const withTiming = () => {};
export const withSpring = () => {};
export const withDecay = () => {};
export const withDelay = () => {};
export const withSequence = () => {};
export const withRepeat = () => {};
export const cancelAnimation = () => {};
export const useAnimatedStyle = () => ({});
export const useSharedValue = (initialValue) => ({ value: initialValue });
export const useDerivedValue = () => ({ value: 0 });
export const useAnimatedGestureHandler = () => ({});
export const useAnimatedScrollHandler = () => ({});
export const useAnimatedRef = () => ({ current: null });
export const measure = () => ({});
export const scrollTo = () => {};
export const useAnimatedProps = () => ({});

export default {
  Animated,
  Easing,
  withTiming,
  withSpring,
  withDecay,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  useAnimatedGestureHandler,
  useAnimatedScrollHandler,
  useAnimatedRef,
  measure,
  scrollTo,
  useAnimatedProps,
};