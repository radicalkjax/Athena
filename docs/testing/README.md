# Athena Testing Documentation

This directory contains comprehensive testing documentation for the Athena project.

## Table of Contents

1. [Getting Started](./getting-started.md) - Quick start guide for running tests
2. [Testing Patterns](./patterns.md) - Common patterns and best practices
3. [Mocking Guidelines](./mocking.md) - How to mock dependencies effectively
4. [Component Testing](./component-testing.md) - Testing React Native components
5. [Service Testing](./service-testing.md) - Testing services and business logic
6. [API Testing](./api-testing.md) - Testing API integrations
7. [Store Testing](./store-testing.md) - Testing Zustand stores
8. [Integration Testing](./integration-testing.md) - Testing complete user workflows
9. [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Quick Commands

```bash
# Run all tests
npm test

# Run specific test file
npx jest path/to/test.test.ts --no-watchman

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Check for circular dependencies
npx madge --circular .

# Verify production build
npm run test:production
```

## Test Statistics

As of Phase 6 completion:
- **Total Tests**: 250+ (and growing)
- **API Layer**: 51 tests ✅
- **Design System**: 17 tests ✅
- **Store**: 13 tests ✅
- **AI Services**: 82 tests ✅
- **Core Services**: 42+ tests ✅
- **Components**: 27+ tests ✅
- **Integration Tests**: 18+ tests ✅ (NEW)

## Testing Philosophy

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Keep tests simple** - If a test is complex, the code might need refactoring
3. **Mock at boundaries** - Mock external dependencies, not internal implementations
4. **Test incrementally** - One test file at a time, verify stability after each change