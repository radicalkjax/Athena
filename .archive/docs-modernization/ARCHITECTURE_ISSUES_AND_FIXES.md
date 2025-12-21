# Architecture Issues and Fixes for Athena Modernization

## Critical Issues Found

### 1. QueryClient Singleton Pattern (CRITICAL)
**Problem**: The QueryClient is created as a singleton at the module level, which causes issues with Expo Router's build process.

```typescript
// WRONG - lib/query-client.ts
let queryClient: QueryClient | null = null;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({...});
  }
  return queryClient;
}
```

**Issue**: 
- This pattern doesn't work well with SSR/SSG in Expo Router
- The singleton is created at build time, not runtime
- Can cause hydration mismatches and undefined components

**Fix**:
```typescript
// CORRECT - Create QueryClient in React state
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient for each request/render
  const [queryClient] = React.useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          retry: 3,
          refetchOnWindowFocus: false,
        },
      },
    })
  );
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### 2. Store Usage in Hook Definitions (HIGH PRIORITY)
**Problem**: Zustand stores are being called at the module level in React Query hooks.

```typescript
// WRONG - hooks/queries/useFiles.ts
export const useMalwareFiles = () => {
  const { malwareFiles } = useFilesStore(); // Called immediately!
  
  return useQuery({...});
};
```

**Issue**:
- Store hooks are called before React context is established
- Can cause infinite loops and re-renders
- Breaks during build optimization

**Fix**:
```typescript
// CORRECT - Only call stores inside the query function
export const useMalwareFiles = () => {
  return useQuery({
    queryKey: filesKeys.malware(),
    queryFn: async (): Promise<MalwareFile[]> => {
      // Get store data inside the query function
      const { malwareFiles } = useFilesStore.getState();
      
      try {
        await fileManagerService.initFileSystem();
        const files = await fileManagerService.listMalwareFiles();
        return files;
      } catch (error) {
        console.error('Error loading malware files:', error);
        return malwareFiles;
      }
    },
    // Don't use store data for initialData at module level
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
};
```

### 3. Provider Hierarchy Issues
**Problem**: Complex provider nesting without proper error boundaries between them.

**Current Structure**:
```typescript
<ErrorBoundary>
  <QueryProvider>
    <ToastProvider>
      <ThemeProvider>
        <Stack />
      </ThemeProvider>
      <ToastManagerConnector />
    </ToastProvider>
  </QueryProvider>
</ErrorBoundary>
```

**Issues**:
- If any provider fails, all fail
- No isolation between provider failures
- ToastManagerConnector depends on ToastProvider context

**Fix**:
```typescript
// Add error boundaries between critical providers
<ErrorBoundary fallback={<BasicErrorScreen />}>
  <QueryProvider>
    <ErrorBoundary fallback={<QueryErrorScreen />}>
      <ToastProvider>
        <ErrorBoundary fallback={<AppWithoutToasts />}>
          <ThemeProvider>
            <Stack />
          </ThemeProvider>
          <ToastManagerConnector />
        </ErrorBoundary>
      </ToastProvider>
    </ErrorBoundary>
  </QueryProvider>
</ErrorBoundary>
```

### 4. Circular Dependencies in Barrel Exports
**Problem**: The components/index.ts file creates circular dependencies.

```typescript
// WRONG - components/index.ts
export * from './features';
export * from './global';
export * from './layout';
// If any of these import from components/index.ts, it's circular
```

**Fix**:
```typescript
// CORRECT - Be explicit and avoid wildcard exports
export { FileUploader } from './features/FileUploader';
export { AIModelSelector } from './features/AIModelSelector';
// etc - explicit exports prevent circular deps
```

### 5. React Query + Zustand Anti-Patterns

**Problem**: Mixing client and server state incorrectly.

```typescript
// WRONG - Using store state as initialData
return useQuery({
  initialData: malwareFiles, // From Zustand store
  ...
});
```

**Issue**: 
- Creates hydration mismatches
- Store state might not be initialized when query runs
- Causes re-render loops

**Fix**:
```typescript
// CORRECT - Keep server and client state separate
export const useMalwareFiles = () => {
  const query = useQuery({
    queryKey: filesKeys.malware(),
    queryFn: fileManagerService.listMalwareFiles,
  });
  
  // Sync to store after successful fetch if needed
  React.useEffect(() => {
    if (query.data) {
      useFilesStore.getState().setMalwareFiles(query.data);
    }
  }, [query.data]);
  
  return query;
};
```

## Expo Router Specific Considerations

### 1. Build-Time vs Runtime
Expo Router pre-renders routes at build time. This means:
- Don't create singletons at module level
- Don't call hooks outside components
- Use dynamic imports for heavy components

### 2. Provider Setup in _layout.tsx
```typescript
// CORRECT - All providers created in React lifecycle
export default function RootLayout() {
  // Create providers in React state/effects
  const [isReady, setIsReady] = React.useState(false);
  
  React.useEffect(() => {
    // Initialize any necessary services
    initializeServices().then(() => setIsReady(true));
  }, []);
  
  if (!isReady) {
    return <SplashScreen />;
  }
  
  return <Providers>...</Providers>;
}
```

## Implementation Checklist

1. [ ] Replace singleton QueryClient with React state version
2. [ ] Move all store calls inside query/mutation functions
3. [ ] Add error boundaries between providers
4. [ ] Remove circular dependencies in barrel exports
5. [ ] Separate server state (React Query) from client state (Zustand)
6. [ ] Add proper loading states for provider initialization
7. [ ] Test production build after each change

## Testing Strategy

1. **Unit Tests**: Mock providers and test components in isolation
2. **Integration Tests**: Test provider interactions
3. **Production Build Tests**: 
   ```bash
   npm run build:web
   npx serve dist
   # Check console for errors
   ```

## Common Error Messages and Solutions

1. **"Cannot read properties of null (reading 'useContext')"**
   - Provider not initialized
   - Hook called outside provider

2. **"Maximum call stack size exceeded"**
   - Circular dependency
   - Infinite re-render loop

3. **"Minified React error #130"**
   - Component is undefined
   - Usually import/export issue

4. **"Hydration failed"**
   - Server/client mismatch
   - Usually from using browser-only APIs during SSR