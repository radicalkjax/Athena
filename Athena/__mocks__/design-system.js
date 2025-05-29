// Mock for design-system components
const React = require('react');
const { TouchableOpacity, Text, View } = require('react-native');

// Mock Button component
const Button = ({ children, onPress, testID, disabled, ...props }) => {
  return React.createElement(
    TouchableOpacity,
    { onPress, testID, disabled, ...props },
    React.createElement(Text, null, children)
  );
};

// Mock Card component
const Card = ({ children, ...props }) => {
  return React.createElement(View, props, children);
};

// Mock Input component
const Input = ({ value, onChangeText, placeholder, ...props }) => {
  const TextInput = require('react-native').TextInput;
  return React.createElement(TextInput, { value, onChangeText, placeholder, ...props });
};

// Mock Modal component
const Modal = ({ visible, children, onRequestClose, ...props }) => {
  const RNModal = require('react-native').Modal;
  return React.createElement(RNModal, { visible, onRequestClose, ...props }, children);
};

// Mock Toast component
const Toast = () => null;

module.exports = {
  Button,
  Card,
  Input,
  Modal,
  Toast,
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    info: '#5AC8FA',
    light: '#F2F2F7',
    dark: '#1C1C1E',
    gray: {
      50: '#F2F2F7',
      100: '#E5E5EA',
      200: '#D1D1D6',
      300: '#C7C7CC',
      400: '#AEAEB2',
      500: '#8E8E93',
      600: '#636366',
      700: '#48484A',
      800: '#3A3A3C',
      900: '#2C2C2E',
    },
    text: {
      primary: '#000000',
      secondary: '#3C3C43',
      tertiary: '#48484A',
      quaternary: '#636366',
      light: '#FFFFFF',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F2F2F7',
      tertiary: '#FFFFFF',
    },
    border: {
      light: '#E5E5EA',
      medium: '#D1D1D6',
      dark: '#C7C7CC',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  fontSizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 28,
    xxxl: 34,
  },
  fontWeights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.75,
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 16,
    },
  }
};