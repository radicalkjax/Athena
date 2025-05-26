# Athena Store Architecture

## Overview

The Athena store uses Zustand 4.5.6 with an enhanced architecture that provides:
- **Type-safe state management** with TypeScript
- **Modular store slices** for better organization
- **Security isolation** for malware handling
- **Performance optimizations** with shallow equality and memoization
- **Persistence** with secure data filtering
- **Development tools** for debugging and monitoring

## Architecture

### Main Store (`/store/index.ts`)

The main application store combines multiple slices:
- **AnalysisSlice**: Manages malware analysis state
- **AIModelSlice**: Handles AI model selection and configuration
- **ContainerSlice**: Manages sandbox containers
- **MalwareSlice**: Handles malware file management

### Security Store (`/store/securityStore.ts`)

A separate, isolated store for security-critical operations:
- **MalwareSamples**: Encrypted malware storage
- **SecurityAlerts**: Real-time security monitoring
- **SandboxSessions**: Container isolation tracking
- **QuarantineMode**: Emergency lockdown capabilities

## Usage Patterns

### Basic Usage

```typescript
import { useAppStore } from '@/store';

function Component() {
  // Direct access (causes re-render on any state change)
  const store = useAppStore();
  
  // Selective subscription (better performance)
  const isAnalyzing = useAppStore(state => state.isAnalyzing);
  const setIsAnalyzing = useAppStore(state => state.setIsAnalyzing);
}
```

### Optimized Selectors

Use pre-built selectors for better performance:

```typescript
import { useAnalysisState, useAnalysisActions } from '@/store/selectors';

function Component() {
  // Uses shallow equality for optimal re-renders
  const { isAnalyzing, analysisResults } = useAnalysisState();
  const { setIsAnalyzing, addAnalysisResult } = useAnalysisActions();
}
```

### Memoized Selectors

For expensive computations:

```typescript
import { useVulnerabilityStats, useAnalysisSuccessRate } from '@/store/selectors/memoized';

function Component() {
  const vulnStats = useVulnerabilityStats(); // Memoized computation
  const successRate = useAnalysisSuccessRate(); // Cached result
}
```

### Security Store Usage

```typescript
import { useSecurityStore, useQuarantineMode } from '@/store/securityStore';

function SecurityComponent() {
  const isQuarantineMode = useQuarantineMode();
  const { addSecurityAlert, startSandboxSession } = useSecurityStore();
  
  // Handle security events
  const handleSuspiciousActivity = () => {
    addSecurityAlert({
      type: 'suspicious_activity',
      severity: 'high',
      message: 'Unusual behavior detected',
    });
  };
}
```

## Middleware

### Development Mode

In development, the store includes:
- **Logger**: Logs all state changes with diffs
- **DevTools**: Redux DevTools integration
- **Performance Monitor**: Warns about slow updates

### Persistence

The persist middleware automatically:
- Saves non-sensitive state to AsyncStorage/localStorage
- Excludes malware content and API keys
- Handles migrations between versions

## Security Considerations

### Data Encryption

All malware samples are encrypted before storage:

```typescript
import { createSecureMalwareSample } from '@/store/utils/security';

const malwareSample = createSecureMalwareSample(
  { name: 'suspicious.exe', size: 1024, type: 'application/x-executable' },
  fileContent,
  'upload'
);
```

### Sanitization

Always sanitize malware data before logging or display:

```typescript
import { sanitizeMalwareData } from '@/store/utils/security';

console.log(sanitizeMalwareData(malwareData)); // Safe to log
```

## Performance Best Practices

### 1. Use Selective Subscriptions

```typescript
// ❌ Bad - re-renders on any state change
const store = useAppStore();

// ✅ Good - re-renders only when specific state changes
const isAnalyzing = useAppStore(state => state.isAnalyzing);
```

### 2. Use Shallow Equality

```typescript
// ❌ Bad - always re-renders
const state = useAppStore(state => ({
  isAnalyzing: state.isAnalyzing,
  results: state.analysisResults,
}));

// ✅ Good - uses shallow equality
import { useAnalysisState } from '@/store/selectors';
const state = useAnalysisState();
```

### 3. Batch Updates

```typescript
// ❌ Bad - multiple renders
setIsAnalyzing(true);
addAnalysisResult(result1);
addAnalysisResult(result2);

// ✅ Good - single render
useAppStore.setState({
  isAnalyzing: true,
  analysisResults: [...results, result1, result2],
});
```

## Testing

### Unit Testing Stores

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAppStore } from '@/store';

test('analysis state updates', () => {
  const { result } = renderHook(() => useAppStore());
  
  act(() => {
    result.current.setIsAnalyzing(true);
  });
  
  expect(result.current.isAnalyzing).toBe(true);
});
```

### Testing with Security Store

```typescript
import { useSecurityStore } from '@/store/securityStore';

test('quarantine mode activates on critical alert', () => {
  const { result } = renderHook(() => useSecurityStore());
  
  act(() => {
    result.current.addSecurityAlert({
      type: 'sandbox_breach',
      severity: 'critical',
      message: 'Test breach',
    });
  });
  
  expect(result.current.isQuarantineMode).toBe(true);
});
```

## Migration Guide

If you're updating existing code:

1. **Replace direct store access** with optimized selectors
2. **Move sensitive data** to the security store
3. **Add shallow equality** to multi-property selectors
4. **Use memoized selectors** for computed values

Example migration:

```typescript
// Before
const Component = () => {
  const store = useAppStore();
  const results = store.analysisResults;
  const isAnalyzing = store.isAnalyzing;
  
  // After
const Component = () => {
  const { analysisResults, isAnalyzing } = useAnalysisState();
```

## Troubleshooting

### High Re-render Count

Use the performance monitor:

```typescript
import { useStorePerformanceMonitor } from '@/store/utils/subscriptions';

function App() {
  useStorePerformanceMonitor(); // Warns about high update frequency
}
```

### State Not Persisting

Check the persist middleware configuration:
- Ensure the state is included in `partialize`
- Verify AsyncStorage permissions
- Check for migration errors

### Security Alerts Not Triggering

Verify the security store is properly initialized:
- Check quarantine mode status
- Ensure security middleware is active
- Verify alert severity levels