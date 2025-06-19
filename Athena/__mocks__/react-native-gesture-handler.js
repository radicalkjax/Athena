// Mock for react-native-gesture-handler
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

export const Directions = {
  RIGHT: 1,
  LEFT: 2,
  UP: 4,
  DOWN: 8,
};

export const GestureHandlerRootView = ({ children }) => children;
export const TapGestureHandler = ({ children }) => children;
export const PanGestureHandler = ({ children }) => children;
export const PinchGestureHandler = ({ children }) => children;
export const RotationGestureHandler = ({ children }) => children;
export const LongPressGestureHandler = ({ children }) => children;
export const ForceTouchGestureHandler = ({ children }) => children;
export const FlingGestureHandler = ({ children }) => children;
export const NativeViewGestureHandler = ({ children }) => children;
export const RawButton = 'RawButton';
export const BaseButton = 'BaseButton';
export const RectButton = 'RectButton';
export const BorderlessButton = 'BorderlessButton';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const TouchableNativeFeedback = 'TouchableNativeFeedback';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const Switch = 'Switch';
export const TextInput = 'TextInput';
export const DrawerLayoutAndroid = 'DrawerLayoutAndroid';
export const RefreshControl = 'RefreshControl';

export const gestureHandlerRootHOC = (component) => component;
export const createNativeWrapper = (component) => component;

export default {
  State,
  Directions,
  GestureHandlerRootView,
  TapGestureHandler,
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  LongPressGestureHandler,
  ForceTouchGestureHandler,
  FlingGestureHandler,
  NativeViewGestureHandler,
  RawButton,
  BaseButton,
  RectButton,
  BorderlessButton,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  TouchableNativeFeedback,
  ScrollView,
  FlatList,
  Switch,
  TextInput,
  DrawerLayoutAndroid,
  RefreshControl,
  gestureHandlerRootHOC,
  createNativeWrapper,
};