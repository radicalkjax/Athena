# Claude Development Notes for Athena

## Testing Best Practices

### API Hooks Testing Issue
When testing hooks that import from the store (like `useAPIStore`), there can be memory issues due to complex middleware and circular dependencies in the test environment. 

**Solution**: Create simplified tests that verify exports and types rather than full integration tests with complex mocking.

### Mocking Guidelines
1. Mock modules BEFORE importing them in tests
2. Use explicit mocks for store functions to avoid loading the full zustand middleware stack
3. For complex hooks, consider testing them through integration tests rather than unit tests

### Known Issues
- The `@env` module from react-native-dotenv causes babel transform errors in tests
- Always use `import { env } from '@/shared/config/environment'` instead of `@env`
- **Local Models Service Tests**: The localModels.ts service causes JavaScript heap out of memory errors during Jest tests, even with minimal mocking. This appears to be related to how the service is structured with recursive initialization calls between `getLocalModelsConfig` and `initLocalModelsDirectory`. The service works fine in production but cannot be unit tested effectively.

## Key Commands

### Running Tests
```bash
# Run specific test file
npx jest path/to/test.test.ts --no-watchman

# Run all tests in a directory
npx jest __tests__/unit/api/ --no-watchman

# Check circular dependencies
npx madge --circular .

# Test production build
npm run test:production
```

### Linting and Type Checking
Before committing, always run:
```bash
npm run lint
npm run typecheck
```

## Architecture Notes

### No Barrel Exports
This project deliberately avoids barrel exports (index.ts files that re-export) to prevent circular dependencies. Always use direct imports.

### API Layer Structure
- `APIErrorHandler` class handles all error scenarios including CORS
- `APIGateway` singleton manages all API clients and caching
- Hooks in `services/api/hooks.ts` provide React integration

### Store Architecture
The store uses Zustand with custom middleware for:
- DevTools integration (development only)
- Logging
- Performance monitoring
- Persistence

Be careful when mocking the store in tests as the middleware can cause memory issues.