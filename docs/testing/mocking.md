# Mocking Guidelines

## Overview

Mocking is essential for isolating units of code during testing. This guide covers common mocking patterns used in the Athena project.

## Module Mocking

### Basic Module Mock
```typescript
jest.mock('@/services/fileManager');
```

### Mock with Implementation
```typescript
jest.mock('@/services/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));
```

### Mock with Factory Function
```typescript
jest.mock('@/hooks', () => {
  const actualHooks = jest.requireActual('@/hooks');
  return {
    ...actualHooks,
    useColorScheme: jest.fn().mockReturnValue('light')
  };
});
```

## Common Mocks in Athena

### 1. React Native Hooks
```typescript
jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn().mockReturnValue('light'),
  useThemeColor: jest.fn().mockReturnValue('#000000')
}));
```

### 2. Expo Modules
```typescript
// expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: '/test/documents/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64'
  },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn()
}));

// expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn()
}));

// expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn().mockReturnValue(true),
  isLoading: jest.fn().mockReturnValue(false)
}));
```

### 3. Icon Libraries
```typescript
// @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialIcons: () => null,
  FontAwesome: () => null
}));

// react-icons
jest.mock('react-icons/ai', () => ({
  AiFillAliwangwang: () => null
}));
jest.mock('react-icons/fa', () => ({
  FaTrash: () => null
}));

// @react-native-picker/picker
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    Picker: ({ children, ...props }) => React.createElement(View, props, children),
    PickerItem: ({ label, value }) => React.createElement(Text, { value }, label)
  };
});

// @react-native-community/slider
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ value, onValueChange, ...props }) => 
    React.createElement(View, { ...props, testID: props.testID || 'slider' });
});
```

### 4. Design System Components
```typescript
// Create __mocks__/design-system.js
const React = require('react');
const { View, Text, TouchableOpacity, Modal: RNModal } = require('react-native');

module.exports = {
  Button: ({ children, onPress, testID, disabled, variant = 'primary', size = 'medium' }) => 
    React.createElement(TouchableOpacity, { onPress, testID, disabled }, 
      React.createElement(Text, null, children)
    ),
  Card: ({ children, variant = 'outlined', testID, style }) => 
    React.createElement(View, { testID, style }, children),
  Input: ({ onChangeText, value, placeholder, testID, secureTextEntry, error }) => 
    React.createElement(View, { testID }, 
      React.createElement(Text, null, value || placeholder)
    ),
  Modal: ({ children, visible, onClose, testID, showCloseButton = true, title }) => 
    visible ? React.createElement(View, { testID }, children) : null,
  Toast: ({ visible, message, type, onDismiss }) => 
    visible ? React.createElement(Text, null, message) : null
};

// In jest.config.js
moduleNameMapper: {
  '^@/design-system$': '<rootDir>/__mocks__/design-system.js',
}
```

### 5. Store Mocking
```typescript
// Mock the entire store
jest.mock('@/store');

// In test file
const mockStore = {
  malwareFiles: [],
  selectedMalwareId: null,
  addMalwareFile: jest.fn(),
  selectMalwareFile: jest.fn(),
  removeMalwareFile: jest.fn()
};

(useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
  return selector(mockStore);
});
```

### 5. AsyncStorage
```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn()
}));
```

### 6. Environment Variables
```typescript
// Mock @env module
jest.mock('@env', () => ({
  OPENAI_API_KEY: 'test-key',
  API_URL: 'http://test.api'
}));

// Or use environment config
jest.mock('@/shared/config/environment', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    DEEPSEEK_API_KEY: 'test-key',
    CLAUDE_API_KEY: 'test-key'
  }
}));
```

## Component Mocking

### Mock Custom Components
```typescript
jest.mock('@/components/ui/IconSymbol', () => {
  const React = require('react');
  return {
    IconSymbol: ({ name, testID, ...props }) => 
      React.createElement('View', { testID: testID || `icon-${name}`, ...props })
  };
});
```

### Mock Complex Components
```typescript
jest.mock('@/components/FileUploader', () => ({
  FileUploader: ({ onFileSelect }) => {
    const React = require('react');
    return React.createElement('Button', {
      onPress: () => onFileSelect({ id: '1', name: 'test.txt' }),
      title: 'Mock Upload'
    });
  }
}));
```

## Service Mocking

### Mock API Services
```typescript
const mockOpenAIService = {
  init: jest.fn(),
  analyzeVulnerabilities: jest.fn(),
  deobfuscateCode: jest.fn(),
  hasApiKey: jest.fn().mockReturnValue(true)
};

jest.mock('@/services/openai', () => mockOpenAIService);
```

### Mock File Services
```typescript
jest.mock('@/services/fileManager', () => ({
  initFileSystem: jest.fn().mockResolvedValue(undefined),
  pickFile: jest.fn(),
  saveFile: jest.fn(),
  deleteFile: jest.fn(),
  listMalwareFiles: jest.fn().mockResolvedValue([])
}));
```

## Advanced Mocking Patterns

### 1. Conditional Mocking
```typescript
jest.mock('@/services/logger', () => {
  if (process.env.NODE_ENV === 'test') {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  }
  return jest.requireActual('@/services/logger');
});
```

### 2. Partial Mocking
```typescript
jest.mock('@/utils/helpers', () => {
  const actual = jest.requireActual('@/utils/helpers');
  return {
    ...actual,
    formatFileSize: jest.fn((size) => `${size} bytes`)
  };
});
```

### 3. Dynamic Mock Values
```typescript
let mockReturnValue = 'light';

jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn(() => mockReturnValue)
}));

// In test
beforeEach(() => {
  mockReturnValue = 'dark';
});
```

## Mock Cleanup

### Clear Mocks Between Tests
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Reset Mocks
```typescript
afterEach(() => {
  jest.resetAllMocks();
});
```

### Restore Original Implementation
```typescript
afterAll(() => {
  jest.restoreAllMocks();
});
```

## Common Issues and Solutions

### Issue: Mock not working
**Solution**: Ensure mock is defined before import
```typescript
// ✅ Correct
jest.mock('@/services/api');
import { apiService } from '@/services/api';

// ❌ Wrong
import { apiService } from '@/services/api';
jest.mock('@/services/api');
```

### Issue: Cannot mock ES6 module
**Solution**: Use factory function
```typescript
jest.mock('@/module', () => ({
  __esModule: true,
  default: jest.fn(),
  namedExport: jest.fn()
}));
```

### Issue: Mock leaking between tests
**Solution**: Clear mocks in beforeEach
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockService.mockReset();
});
```