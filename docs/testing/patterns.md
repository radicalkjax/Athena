# Testing Patterns and Best Practices

## General Patterns

### 1. Arrange-Act-Assert (AAA)
```typescript
it('should handle file upload', async () => {
  // Arrange
  const mockFile = { name: 'test.txt', size: 100 };
  mockFileService.upload.mockResolvedValue(mockFile);
  
  // Act
  const result = await uploadFile(mockFile);
  
  // Assert
  expect(result).toEqual(mockFile);
  expect(mockFileService.upload).toHaveBeenCalledWith(mockFile);
});
```

### 2. Test Behavior, Not Implementation
```typescript
// ❌ Bad - Testing implementation details
it('should call setState', () => {
  component.handleClick();
  expect(setState).toHaveBeenCalled();
});

// ✅ Good - Testing behavior
it('should show success message after upload', async () => {
  fireEvent.press(getByText('Upload'));
  await waitFor(() => {
    expect(getByText('Upload successful')).toBeTruthy();
  });
});
```

### 3. Use Descriptive Test Names
```typescript
// ❌ Bad
it('test 1', () => {});

// ✅ Good
it('should display error message when API key is missing', () => {});
```

## Component Testing Patterns

### 1. Mock Complex Dependencies
```typescript
// Mock hooks at the top
jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn().mockReturnValue('light'),
  useThemeColor: jest.fn().mockReturnValue('#000000')
}));

// Mock icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialIcons: () => null
}));
```

### 2. Test User Interactions
```typescript
it('should handle button press', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button onPress={onPress}>Click me</Button>);
  
  fireEvent.press(getByText('Click me'));
  expect(onPress).toHaveBeenCalled();
});
```

### 3. Test Different States
```typescript
describe('LoadingComponent', () => {
  it('should show loading state', () => {
    const { getByTestId } = render(<LoadingComponent loading={true} />);
    expect(getByTestId('loading-spinner')).toBeTruthy();
  });
  
  it('should show content when not loading', () => {
    const { getByText } = render(<LoadingComponent loading={false} />);
    expect(getByText('Content')).toBeTruthy();
  });
});
```

## Service Testing Patterns

### 1. Mock External Dependencies
```typescript
jest.mock('@/config/api', () => ({
  API_URL: 'http://test.api'
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/test/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn()
}));
```

### 2. Test Error Handling
```typescript
it('should handle network errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  
  await expect(apiService.getData()).rejects.toThrow('Network error');
  expect(logger.error).toHaveBeenCalled();
});
```

### 3. Test Async Operations
```typescript
it('should process file asynchronously', async () => {
  const mockFile = { content: 'test' };
  mockFileProcessor.process.mockResolvedValue({ processed: true });
  
  const result = await processFile(mockFile);
  
  expect(result).toEqual({ processed: true });
  expect(mockFileProcessor.process).toHaveBeenCalledWith(mockFile);
});
```

## Store Testing Patterns

### 1. Test Store Actions
```typescript
it('should add malware file to store', () => {
  const { result } = renderHook(() => useAppStore());
  const file = { id: '1', name: 'test.exe' };
  
  act(() => {
    result.current.addMalwareFile(file);
  });
  
  expect(result.current.malwareFiles).toContainEqual(file);
});
```

### 2. Mock Store in Components
```typescript
const mockStore = {
  malwareFiles: [],
  addMalwareFile: jest.fn(),
  selectMalwareFile: jest.fn()
};

(useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
  return selector(mockStore);
});
```

## API Testing Patterns

### 1. Mock Fetch Calls
```typescript
global.fetch = jest.fn();

beforeEach(() => {
  (fetch as jest.Mock).mockClear();
});

it('should fetch data from API', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' })
  });
  
  const result = await apiClient.get('/endpoint');
  expect(result).toEqual({ data: 'test' });
});
```

### 2. Test Request Headers
```typescript
it('should include auth header', async () => {
  await apiClient.get('/protected');
  
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer token'
      })
    })
  );
});
```

## Common Pitfalls to Avoid

1. **Don't test implementation details** - Focus on public APIs
2. **Don't mock everything** - Only mock external dependencies
3. **Don't write brittle tests** - Tests should not break with refactoring
4. **Don't forget cleanup** - Clear mocks and timers after each test
5. **Don't ignore async behavior** - Always handle promises properly