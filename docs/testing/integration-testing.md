# Integration Testing Guide

## Overview

Integration tests verify that multiple components and services work together correctly to complete user workflows. These tests are critical for ensuring the application functions properly from the user's perspective.

## Test Structure

Integration tests are located in `__tests__/integration/` and focus on testing complete user journeys.

### Current Integration Tests

1. **Malware Analysis Workflow** (`malware-analysis-workflow.test.tsx`)
   - Tests the complete flow from file upload through analysis to results
   - Verifies state management throughout the process
   - Ensures proper service integration

2. **File Upload to Results Display** (`file-upload-results-flow.test.tsx`)
   - Tests the user journey from uploading a file to viewing results
   - Focuses on UI state transitions
   - Verifies component interactions

3. **Container Configuration Flow** (`container-configuration-flow.test.tsx`)
   - Tests container setup and deployment
   - Verifies monitoring integration
   - Tests resource configuration

## Setup and Utilities

The `setup.ts` file provides common utilities for integration tests:

### Mock Services
```typescript
import { mockServices } from './setup';

// Use realistic service mocks with delays
Object.assign(fileManagerService, mockServices.fileManager);
Object.assign(analysisService, mockServices.analysisService);
```

### Store Reset
```typescript
import { resetStores } from './setup';

beforeEach(() => {
  resetStores(); // Reset all stores to initial state
});
```

### Test Data Generators
```typescript
import { generateMalwareFile, generateContainerConfig } from './setup';

const file = generateMalwareFile({ name: 'custom.exe' });
const config = generateContainerConfig({ os: 'windows' });
```

## Writing Integration Tests

### 1. Test Complete User Journeys
```typescript
it('should complete full malware analysis workflow', async () => {
  // Upload file
  fireEvent.press(getByText('Upload'));
  await waitFor(() => expect(getByText('malicious.exe')).toBeTruthy());
  
  // Select file
  fireEvent.press(getByText('malicious.exe'));
  
  // Start analysis
  fireEvent.press(getByText('Analyze'));
  
  // Wait for results
  await waitFor(() => expect(getByTestId('analysis-results')).toBeTruthy());
  
  // Verify results
  expect(getByText(/Risk Score: 8.5/)).toBeTruthy();
});
```

### 2. Test State Transitions
```typescript
it('should properly manage state throughout workflow', async () => {
  // Initial state
  let state = useAppStore.getState();
  expect(state.malwareFiles).toHaveLength(0);
  
  // After upload
  fireEvent.press(getByText('Upload'));
  await waitFor(() => {
    state = useAppStore.getState();
    expect(state.malwareFiles).toHaveLength(1);
  });
  
  // During analysis
  fireEvent.press(getByText('Analyze'));
  await waitFor(() => {
    state = useAppStore.getState();
    expect(state.isAnalyzing).toBe(true);
  });
});
```

### 3. Test Error Scenarios
```typescript
it('should handle service failures gracefully', async () => {
  // Mock service to fail
  analysisService.analyzeFile = jest.fn().mockRejectedValue(
    new Error('Service unavailable')
  );
  
  // Attempt workflow
  // ... upload and select file ...
  
  fireEvent.press(getByText('Analyze'));
  
  // Verify error handling
  await waitFor(() => {
    expect(getByText(/Service unavailable/)).toBeTruthy();
    expect(queryByTestId('analysis-results')).toBeFalsy();
  });
});
```

### 4. Test Performance
```typescript
it('should complete workflow within acceptable time', async () => {
  const startTime = Date.now();
  
  // Complete workflow...
  
  const endTime = Date.now();
  expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
});
```

## Best Practices

### 1. Use Realistic Delays
```typescript
// In mock services
pickFile: jest.fn().mockImplementation(async () => {
  // Simulate realistic delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockFile;
})
```

### 2. Test UI Feedback
```typescript
// Verify loading states
fireEvent.press(getByText('Analyze'));
await waitFor(() => expect(getByText('Analyzing...')).toBeTruthy());

// Verify completion
await waitFor(() => expect(queryByText('Analyzing...')).toBeFalsy());
```

### 3. Test Multiple Scenarios
```typescript
describe('File Upload Flow', () => {
  it('should handle single file upload', async () => { /* ... */ });
  it('should handle multiple file uploads', async () => { /* ... */ });
  it('should handle upload cancellation', async () => { /* ... */ });
  it('should handle large files', async () => { /* ... */ });
});
```

### 4. Verify Service Integration
```typescript
// Verify correct service calls
expect(analysisService.analyzeFile).toHaveBeenCalledWith(
  expect.objectContaining({ name: 'malicious.exe' }),
  expect.objectContaining({ deepAnalysis: true })
);
```

## Common Patterns

### Testing Navigation Flow
```typescript
it('should navigate through screens correctly', async () => {
  // Start on home screen
  expect(getByTestId('home-screen')).toBeTruthy();
  
  // Navigate to upload
  fireEvent.press(getByText('Upload File'));
  await waitFor(() => expect(getByTestId('upload-screen')).toBeTruthy());
  
  // Continue through flow...
});
```

### Testing Concurrent Operations
```typescript
it('should handle multiple analyses concurrently', async () => {
  // Upload multiple files
  const files = ['virus1.exe', 'virus2.exe', 'virus3.exe'];
  
  for (const fileName of files) {
    // Upload each file...
  }
  
  // Start all analyses
  const analyzePromises = files.map(fileName => {
    fireEvent.press(getByText(`Analyze ${fileName}`));
    return waitFor(() => expect(getByText(`${fileName} - Complete`)).toBeTruthy());
  });
  
  // Wait for all to complete
  await Promise.all(analyzePromises);
});
```

### Testing Data Persistence
```typescript
it('should persist data across component remounts', async () => {
  const { unmount } = render(<App />);
  
  // Perform actions...
  fireEvent.press(getByText('Save'));
  
  // Unmount and remount
  unmount();
  const { getByText } = render(<App />);
  
  // Verify data persisted
  expect(getByText('Saved data')).toBeTruthy();
});
```

## Debugging Integration Tests

### 1. Use Debug Output
```typescript
const { debug } = render(<Component />);
debug(); // Prints component tree
```

### 2. Add Console Logs
```typescript
// In your test
console.log('Store state:', useAppStore.getState());

// In your component
console.log('Component rendered with props:', props);
```

### 3. Increase Timeouts
```typescript
await waitFor(() => {
  expect(getByText('Result')).toBeTruthy();
}, { timeout: 10000 }); // 10 seconds
```

### 4. Test in Isolation
If an integration test fails, create smaller tests to isolate the issue:
```typescript
// Test just the upload component
it('should upload file', async () => { /* ... */ });

// Test just the analysis service
it('should analyze file', async () => { /* ... */ });
```

## Running Integration Tests

```bash
# Run all integration tests
npx jest __tests__/integration

# Run specific integration test
npx jest __tests__/integration/malware-analysis-workflow.test.tsx

# Run with coverage
npx jest __tests__/integration --coverage

# Run in watch mode
npx jest __tests__/integration --watch
```

## Tips for Writing Good Integration Tests

1. **Focus on User Behavior** - Test what users actually do
2. **Keep Tests Independent** - Each test should start from a clean state
3. **Use Descriptive Names** - Test names should explain the scenario
4. **Test Happy and Sad Paths** - Include both success and failure scenarios
5. **Avoid Implementation Details** - Test behavior, not how it's implemented
6. **Use Realistic Data** - Mock data should resemble production data
7. **Test Edge Cases** - Empty states, maximum values, concurrent operations
8. **Maintain Test Speed** - Balance realism with execution time