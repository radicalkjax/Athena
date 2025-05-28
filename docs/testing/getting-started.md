# Getting Started with Testing

## Prerequisites

- Node.js 18+ installed
- All dependencies installed (`npm install`)
- Understanding of Jest and React Testing Library

## Running Tests

### Run All Tests
```bash
cd /workspaces/Athena/Athena
npm test
```

### Run Specific Test File
```bash
npx jest __tests__/unit/services/fileManager.test.ts --no-watchman
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Structure

```
Athena/__tests__/
├── unit/
│   ├── api/            # API layer tests
│   ├── services/       # Service tests
│   │   ├── ai/         # AI service tests
│   │   └── ...
│   ├── components/     # Component tests
│   └── design-system/  # Design system tests
├── integration/        # Integration tests (future)
├── e2e/               # End-to-end tests (future)
├── fixtures/          # Test data
└── utils/            # Test helpers
```

## Writing Your First Test

1. Create a test file with `.test.ts` or `.test.tsx` extension
2. Import the module you want to test
3. Mock external dependencies
4. Write test cases using `describe` and `it` blocks

Example:
```typescript
import { myFunction } from '@/services/myService';

jest.mock('@/external/dependency');

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## Common Test Patterns

- **Async Testing**: Use `async/await` with `waitFor`
- **Component Testing**: Use `render` from React Testing Library
- **Mocking**: Mock at module level before imports
- **Store Testing**: Mock `useAppStore` for component tests

## Next Steps

- Read [Testing Patterns](./patterns.md) for best practices
- Check [Mocking Guidelines](./mocking.md) for dependency mocking
- See [Troubleshooting](./troubleshooting.md) for common issues