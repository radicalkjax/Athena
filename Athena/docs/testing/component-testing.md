# Component Testing Guide

## Overview

This guide covers testing React Native components in the Athena project using React Native Testing Library.

## Setup

### Required Imports
```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ComponentToTest } from '@/components/ComponentToTest';
```

### Common Mocks
```typescript
// Mock hooks
jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn().mockReturnValue('light'),
  useThemeColor: jest.fn().mockReturnValue('#000000')
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn()
};
```

## Testing Patterns

### 1. Basic Component Rendering
```typescript
describe('Button Component', () => {
  it('should render correctly', () => {
    const { getByText } = render(
      <Button title="Click me" onPress={() => {}} />
    );
    
    expect(getByText('Click me')).toBeTruthy();
  });
});
```

### 2. Testing Props
```typescript
it('should apply variant styles', () => {
  const { getByTestId } = render(
    <Card variant="filled" testID="card" />
  );
  
  const card = getByTestId('card');
  expect(card.props.style).toContainEqual(
    expect.objectContaining({ backgroundColor: '#4A90E2' })
  );
});
```

### 3. Testing User Interactions
```typescript
it('should handle button press', () => {
  const onPress = jest.fn();
  const { getByText } = render(
    <Button title="Submit" onPress={onPress} />
  );
  
  fireEvent.press(getByText('Submit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

### 4. Testing State Changes
```typescript
it('should toggle switch state', () => {
  const { getByTestId } = render(<ToggleSwitch testID="switch" />);
  const switchElement = getByTestId('switch');
  
  expect(switchElement.props.value).toBe(false);
  
  fireEvent(switchElement, 'onValueChange', true);
  expect(switchElement.props.value).toBe(true);
});
```

### 5. Testing Async Behavior
```typescript
it('should load data on mount', async () => {
  const { getByText, queryByTestId } = render(<DataList />);
  
  // Initially shows loading
  expect(queryByTestId('loading')).toBeTruthy();
  
  // Wait for data to load
  await waitFor(() => {
    expect(getByText('Data loaded')).toBeTruthy();
  });
  
  // Loading indicator should be gone
  expect(queryByTestId('loading')).toBeFalsy();
});
```

## Component-Specific Examples

### FileUploader Component
```typescript
describe('FileUploader', () => {
  const mockOnFileSelect = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle file upload', async () => {
    const mockFile = {
      id: '1',
      name: 'test.txt',
      size: 1024,
      uri: 'file:///test.txt'
    };
    
    mockFileManagerService.pickFile.mockResolvedValue(mockFile);
    
    const { getByText } = render(
      <FileUploader onFileSelect={mockOnFileSelect} />
    );
    
    fireEvent.press(getByText('Upload'));
    
    await waitFor(() => {
      expect(mockOnFileSelect).toHaveBeenCalledWith(mockFile);
    });
  });
});
```

### ContainerConfigSelector Component
```typescript
describe('ContainerConfigSelector', () => {
  it('should update config on OS change', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <ContainerConfigSelector 
        initialConfig={defaultConfig}
        onChange={onChange}
      />
    );
    
    fireEvent.press(getByText('Windows'));
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ os: 'windows' })
    );
  });
});
```

### Modal Component
```typescript
describe('Modal', () => {
  it('should show and hide modal', () => {
    const onClose = jest.fn();
    const { getByText, rerender, queryByText } = render(
      <Modal visible={true} onClose={onClose}>
        <ThemedText>Modal Content</ThemedText>
      </Modal>
    );
    
    expect(getByText('Modal Content')).toBeTruthy();
    
    // Test close button
    fireEvent.press(getByTestId('modal-close'));
    expect(onClose).toHaveBeenCalled();
    
    // Test hiding
    rerender(
      <Modal visible={false} onClose={onClose}>
        <ThemedText>Modal Content</ThemedText>
      </Modal>
    );
    
    expect(queryByText('Modal Content')).toBeFalsy();
  });
});
```

## Testing with Store

### Mocking Store in Components
```typescript
const mockStore = {
  malwareFiles: [
    { id: '1', name: 'test.exe', size: 1024 }
  ],
  selectedMalwareId: '1',
  selectMalwareFile: jest.fn(),
  addMalwareFile: jest.fn()
};

beforeEach(() => {
  (useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
    return selector(mockStore);
  });
});
```

## Testing Lists and ScrollViews

```typescript
it('should render list of items', () => {
  const items = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' }
  ];
  
  const { getAllByText } = render(<ItemList items={items} />);
  
  const renderedItems = getAllByText(/Item \d/);
  expect(renderedItems).toHaveLength(2);
});
```

## Accessibility Testing

```typescript
it('should have proper accessibility labels', () => {
  const { getByLabelText } = render(
    <Button 
      title="Submit" 
      accessibilityLabel="Submit form"
      onPress={() => {}}
    />
  );
  
  expect(getByLabelText('Submit form')).toBeTruthy();
});
```

## Common Pitfalls

### 1. Not Waiting for Async Updates
```typescript
// ❌ Wrong
fireEvent.press(getByText('Load'));
expect(getByText('Loaded')).toBeTruthy(); // Might fail

// ✅ Correct
fireEvent.press(getByText('Load'));
await waitFor(() => {
  expect(getByText('Loaded')).toBeTruthy();
});
```

### 2. Testing Implementation Details
```typescript
// ❌ Wrong - Testing state directly
expect(component.state.isOpen).toBe(true);

// ✅ Correct - Testing visible behavior
expect(getByTestId('modal')).toBeTruthy();
```

### 3. Not Cleaning Up
```typescript
// Always clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  cleanup(); // If not done automatically
});
```

## Tips for Better Component Tests

1. **Use data-testid** for elements that are hard to query
2. **Test user behavior**, not implementation
3. **Keep tests focused** - one behavior per test
4. **Use descriptive test names** that explain the expected behavior
5. **Mock external dependencies** but not internal component logic
6. **Test edge cases** - empty states, errors, loading states
7. **Test accessibility** - ensure components are usable by everyone