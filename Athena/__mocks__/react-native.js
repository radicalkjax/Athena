// Mock for react-native
export const Platform = {
  OS: 'ios',
  Version: 16,
  select: (obj) => obj.ios || obj.default,
  isPad: false,
  isTV: false,
  isTVOS: false,
  isTesting: true,
};

export const NativeModules = {
  ExpoModulesCore: {},
  ExpoFileSystem: {},
  ExpoDocumentPicker: {},
  ExpoFont: {},
  ExpoRouter: {},
  ExpoConstants: {
    manifest: {},
    deviceName: 'Test Device',
    systemVersion: '15.0',
  },
  ExpoDevice: {
    deviceType: 1,
    isDevice: true,
    totalMemory: 8000000000,
  },
  ExpoSecureStore: {
    getItemAsync: () => Promise.resolve(null),
    setItemAsync: () => Promise.resolve(),
    deleteItemAsync: () => Promise.resolve(),
  },
  ExpoDocumentPicker: {
    getDocumentAsync: () => Promise.resolve({
      type: 'success',
      uri: 'file:///mock/test.txt',
      name: 'test.txt',
      size: 1024,
    }),
  },
};

export const NativeEventEmitter = class NativeEventEmitter {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {}
  emit() {}
};

export const DeviceEventEmitter = {
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {},
  emit: () => {},
};

export const Alert = {
  alert: () => {},
};

export const Linking = {
  openURL: () => Promise.resolve(),
  canOpenURL: () => Promise.resolve(true),
  getInitialURL: () => Promise.resolve(null),
};

export const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  absoluteFillObject: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size) => size * 2,
  roundToNearestPixel: (size) => Math.round(size * 2) / 2,
};

// UI Components
export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const ActivityIndicator = 'ActivityIndicator';
export const Switch = 'Switch';
export const Image = 'Image';
export const SafeAreaView = 'SafeAreaView';
export const Modal = 'Modal';
export const StatusBar = 'StatusBar';

// Animated API mock
export const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  ScrollView: 'Animated.ScrollView',
  FlatList: 'Animated.FlatList',
  Image: 'Animated.Image',
  
  Value: class AnimatedValue {
    constructor(value) {
      this._value = value;
    }
    setValue(value) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
  },
  
  timing: (value, config) => ({
    start: (callback) => {
      value.setValue(config.toValue);
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  spring: (value, config) => ({
    start: (callback) => {
      value.setValue(config.toValue);
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  decay: (value, config) => ({
    start: (callback) => {
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  sequence: (animations) => ({
    start: (callback) => {
      animations.forEach(animation => animation.start && animation.start());
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  parallel: (animations) => ({
    start: (callback) => {
      animations.forEach(animation => animation.start && animation.start());
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  stagger: (time, animations) => ({
    start: (callback) => {
      animations.forEach(animation => animation.start && animation.start());
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  loop: (animation) => ({
    start: (callback) => {
      animation.start && animation.start();
      if (callback) {
        callback({ finished: true });
      }
    },
  }),
  
  createAnimatedComponent: (Component) => Component,
  
  event: () => () => {},
  
  add: (a, b) => ({ _value: a._value + b._value }),
  subtract: (a, b) => ({ _value: a._value - b._value }),
  multiply: (a, b) => ({ _value: a._value * b._value }),
  divide: (a, b) => ({ _value: a._value / b._value }),
  
  interpolate: () => ({ _value: 0 }),
  
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    quad: (t) => t * t,
    cubic: (t) => t * t * t,
    poly: (n) => (t) => Math.pow(t, n),
    sin: (t) => 1 - Math.cos(t * Math.PI / 2),
    circle: (t) => 1 - Math.sqrt(1 - t * t),
    exp: (t) => Math.pow(2, 10 * (t - 1)),
    elastic: (bounciness) => (t) => t,
    back: (s) => (t) => t,
    bounce: (t) => t,
    bezier: (x1, y1, x2, y2) => (t) => t,
    in: (easing) => easing,
    out: (easing) => (t) => 1 - easing(1 - t),
    inOut: (easing) => (t) => t < 0.5 ? easing(t * 2) / 2 : (2 - easing((1 - t) * 2)) / 2,
  },
};

export default {
  Platform,
  NativeModules,
  NativeEventEmitter,
  DeviceEventEmitter,
  Alert,
  Linking,
  StyleSheet,
  Dimensions,
  PixelRatio,
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Switch,
  Image,
  SafeAreaView,
  Modal,
  StatusBar,
  Animated,
};