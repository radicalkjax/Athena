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

```mermaid
graph TB
    subgraph "__tests__"
        subgraph "unit"
            API[api/<br/>━━━━━━━━<br/>• errorHandler.test.ts<br/>• gateway.test.ts<br/>• hooks.simple.test.tsx]
            SERVICES[services/<br/>━━━━━━━━<br/>• AI services<br/>• Core services<br/>• Utilities]
            COMPONENTS[components/<br/>━━━━━━━━<br/>• UI components<br/>• Containers<br/>• Screens]
            DS[design-system/<br/>━━━━━━━━<br/>• Buttons<br/>• Cards<br/>• Inputs]
        end
        
        subgraph "integration"
            WORKFLOWS[User Workflows<br/>━━━━━━━━<br/>• File upload flow<br/>• Analysis flow<br/>• Container setup]
        end
        
        subgraph "support"
            FIXTURES[fixtures/<br/>━━━━━━━━<br/>• Mock data<br/>• API responses<br/>• Test files]
            UTILS[utils/<br/>━━━━━━━━<br/>• Test helpers<br/>• Render utils<br/>• Mock factories]
        end
    end
    
    style API fill:#e1e5ff
    style SERVICES fill:#e1e5ff
    style COMPONENTS fill:#e1e5ff
    style DS fill:#e1e5ff
    style WORKFLOWS fill:#fff4e1
    style FIXTURES fill:#e1f5e1
    style UTILS fill:#e1f5e1
```

## Test Workflow

```mermaid
flowchart LR
    subgraph "Development"
        WRITE[Write Code]
        TEST[Write Test]
        RUN[Run Test]
    end
    
    subgraph "Validation"
        PASS{Test Passes?}
        COV{Coverage OK?}
        CI{CI Passes?}
    end
    
    subgraph "Completion"
        COMMIT[Commit Code]
        PR[Create PR]
        MERGE[Merge]
    end
    
    WRITE --> TEST
    TEST --> RUN
    RUN --> PASS
    
    PASS -->|No| TEST
    PASS -->|Yes| COV
    
    COV -->|No| TEST
    COV -->|Yes| COMMIT
    
    COMMIT --> CI
    CI -->|No| TEST
    CI -->|Yes| PR
    
    PR --> MERGE
    
    style WRITE fill:#e1e5ff
    style TEST fill:#e1e5ff
    style RUN fill:#e1e5ff
    style PASS fill:#fff4e1
    style COV fill:#fff4e1
    style CI fill:#fff4e1
    style COMMIT fill:#e1f5e1
    style PR fill:#e1f5e1
    style MERGE fill:#e1f5e1
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

```mermaid
graph TB
    subgraph "Testing Patterns"
        ASYNC[Async Testing<br/>━━━━━━━━<br/>• async/await<br/>• waitFor<br/>• act wrapper]
        COMP[Component Testing<br/>━━━━━━━━<br/>• render()<br/>• fireEvent<br/>• screen queries]
        MOCK[Mocking<br/>━━━━━━━━<br/>• Module level<br/>• Before imports<br/>• Reset in afterEach]
        STORE[Store Testing<br/>━━━━━━━━<br/>• Mock useAppStore<br/>• Test actions<br/>• Test selectors]
    end
    
    subgraph "Best Practices"
        AAA[Arrange-Act-Assert<br/>━━━━━━━━<br/>• Setup test data<br/>• Execute action<br/>• Verify result]
        ISO[Test Isolation<br/>━━━━━━━━<br/>• Independent tests<br/>• Clean state<br/>• No side effects]
        DESC[Descriptive Names<br/>━━━━━━━━<br/>• Clear intent<br/>• Expected behavior<br/>• Edge cases]
    end
    
    ASYNC --> AAA
    COMP --> AAA
    MOCK --> ISO
    STORE --> ISO
    
    AAA --> DESC
    ISO --> DESC
    
    style ASYNC fill:#e1e5ff
    style COMP fill:#e1e5ff
    style MOCK fill:#fff4e1
    style STORE fill:#fff4e1
    style AAA fill:#e1f5e1
    style ISO fill:#e1f5e1
    style DESC fill:#e1f5e1
```

## Next Steps

- Read [Testing Patterns](./patterns.md) for best practices
- Check [Mocking Guidelines](./mocking.md) for dependency mocking
- See [Troubleshooting](./troubleshooting.md) for common issues