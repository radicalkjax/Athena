# Testing Troubleshooting Guide

## Common Issues and Solutions

### 1. Jest Environment Teardown Errors

**Error**: `ReferenceError: You are trying to access a property or method of the Jest environment after it has been torn down`

**Solutions**:
- Add proper cleanup in afterEach hooks
- Clear all timers: `jest.clearAllTimers()`
- Use `waitFor` with proper timeout
- Ensure async operations complete before test ends
- Use fake timers to control async behavior

```typescript
// Proper timer setup and cleanup
describe('Component with timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  it('should handle delayed operations', async () => {
    const { getByText } = render(<Component />);
    
    // Trigger action that starts timer
    fireEvent.press(getByText('Start'));
    
    // Advance timers
    jest.advanceTimersByTime(1000);
    
    // Verify result
    expect(getByText('Complete')).toBeTruthy();
  });
});

// For async tests without fake timers
it('should handle async operation', async () => {
  const result = render(<Component />);
  
  await waitFor(() => {
    expect(something).toBeTruthy();
  }, { timeout: 3000 });
  
  // Ensure cleanup
  result.unmount();
});
```

### 2. Module Mock Issues

**Error**: `The module factory of jest.mock() is not allowed to reference any out-of-scope variables`

**Solution**: Use require inside the mock factory
```typescript
// ❌ Wrong
jest.mock('@/component', () => ({
  Component: () => React.createElement('View') // React is out of scope
}));

// ✅ Correct
jest.mock('@/component', () => {
  const React = require('react');
  return {
    Component: () => React.createElement('View')
  };
});
```

### 3. Expo Module Mocking

**Error**: `Cannot read property 'documentDirectory' of undefined`

**Solution**: Add proper expo mocks in jest.setup.js
```typescript
// jest.setup.js
jest.mock('expo-file-system', () => ({
  documentDirectory: '/test/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64'
  },
  // ... other methods
}));
```

### 4. Memory Issues

**Error**: `JavaScript heap out of memory`

**Solutions**:
- Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096 npm test`
- Simplify complex mocks
- Run tests in smaller batches
- Clear module cache between tests

```typescript
afterEach(() => {
  jest.resetModules();
});
```

### 5. Circular Dependencies

**Error**: Tests hang or fail with maximum call stack exceeded

**Solution**: Check for circular dependencies
```bash
npx madge --circular .
```

If found, refactor to remove circular imports.

### 6. AsyncStorage Mock Issues

**Error**: `[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null`

**Solution**: Mock AsyncStorage properly
```typescript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

### 7. React Native Components Not Found

**Error**: `Invariant Violation: TurboModuleRegistry.getEnforcing(...)`

**Solution**: Mock the native module
```typescript
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  getEnforcing: () => ({
    // Mock methods as needed
  }),
}));
```

### 8. Font Loading Issues

**Error**: `fontFamily "Roboto" is not a system font`

**Solution**: Mock expo-font
```typescript
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
}));
```

### 9. Navigation Mock Issues

**Error**: `Cannot read property 'navigate' of undefined`

**Solution**: Mock navigation prop
```typescript
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

render(<Component navigation={mockNavigation} />);
```

### 10. Component Export Mismatches

**Error**: `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined`

**Cause**: Component uses default export but test imports as named export (or vice versa)

**Solution**: Check and match export types
```typescript
// ❌ Wrong - Component uses named export
// Component file
export const MyComponent = () => <View />;

// Test file
import MyComponent from '@/components/MyComponent'; // Incorrect!

// ✅ Correct
import { MyComponent } from '@/components/MyComponent';

// For components that changed from default to named export:
// Before: export default ContainerConfigSelector
// After: export { ContainerConfigSelector }
// Update imports: import { ContainerConfigSelector } from '...'
```

### 11. Store Testing Issues

**Error**: Complex middleware causing test failures

**Solution**: Create simplified store for tests
```typescript
// test-utils.tsx
export const createMockStore = (initialState = {}) => {
  const store = {
    ...defaultState,
    ...initialState,
    // Mock actions
    addMalwareFile: jest.fn(),
    selectMalwareFile: jest.fn(),
  };
  
  return store;
};
```

## Performance Issues

### Slow Test Execution

**Solutions**:
1. Run tests in parallel: `jest --maxWorkers=4`
2. Use `--no-cache` flag if cache is corrupted
3. Disable coverage for faster runs: `jest --coverage=false`
4. Use `--onlyChanged` to run only changed files

### Test Timeout Issues

**Solution**: Increase timeout for specific tests
```typescript
it('should handle long operation', async () => {
  // Increase timeout to 10 seconds
  jest.setTimeout(10000);
  
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000);
```

## Debugging Tips

### 1. Debug Output
```typescript
// Add console.logs (remember to remove after debugging)
console.log('Component state:', component.debug());

// Use debug from React Testing Library
const { debug } = render(<Component />);
debug(); // Prints component tree
```

### 2. Run Single Test
```bash
# Run specific test
npx jest --testNamePattern="should handle file upload"

# Run in watch mode for specific file
npx jest --watch path/to/test.ts
```

### 3. Verbose Output
```bash
# See detailed test execution
npm test -- --verbose

# See individual test results
npm test -- --verbose --expand
```

### 4. Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-coverage", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Best Practices for Avoiding Issues

1. **Always mock external dependencies** before imports
2. **Use proper cleanup** in afterEach hooks
3. **Handle async operations** with await and waitFor
4. **Keep tests isolated** - no shared state between tests
5. **Mock at the right level** - not too deep, not too shallow
6. **Use TypeScript** for better IDE support and error catching
7. **Follow the AAA pattern** - Arrange, Act, Assert
8. **Keep tests simple** - if it's complex, refactor the code