# Athena WASM Integration - Phase 4: Test Migration Session

## Previous Session Summary

### What We Accomplished
1. **Fixed TypeScript Compilation Errors**
   - Created `/workspaces/Athena/Athena/services/wasm-stubs.ts` with complete type definitions and mock implementations for all WASM modules
   - Created `/workspaces/Athena/vitest.config.ts` with proper path mappings
   - Created `/workspaces/Athena/vitest.setup.js` with vitest-compatible mocks
   - Result: ✅ TypeScript compilation passes with 0 errors

2. **Fixed All ESLint Errors**
   - Updated `/workspaces/Athena/Athena/.eslintrc.js` to define necessary globals
   - Fixed import issues (removed react-redux, ExternalLink)
   - Fixed incorrect function names in `analysisServiceEnhanced.ts`
   - Refactored dynamic environment variable access in `featureFlags.ts`
   - Result: ✅ ESLint shows 0 errors (212 warnings remain, non-critical)

3. **Migrated `analysisService.test.ts` to Vitest**
   - Converted from Jest to Vitest syntax (vi instead of jest)
   - Fixed all type mismatches
   - Fixed mock implementations
   - Result: ✅ All 9 tests passing

### Current State
- **Working Directory**: `/workspaces/Athena`
- **Branch**: `WASM-posture`
- **Modified Files**:
  - `Athena/__tests__/unit/services/analysisService.test.ts` (migrated to vitest)
  - `Athena/services/wasm-stubs.ts` (created)
  - `Athena/services/analysisServiceEnhanced.ts` (fixed function names)
  - `Athena/services/config/featureFlags.ts` (removed dynamic env access)
  - `Athena/.eslintrc.js` (added globals and rules)
  - `Athena/app/(tabs)/about.tsx` (removed unused import)
  - `Athena/__tests__/utils/test-utils.tsx` (removed redux dependency)
  - `/vitest.config.ts` (created)
  - `/vitest.setup.js` (created)

## Current Testing Situation

### Test Runner Status
- Project has migrated from Jest to Vitest
- Main package.json uses: `"test": "vitest"`
- Athena package.json uses: `"test": "expo test"` which runs vitest

### Test Results
- **Total Test Files**: 115 (114 failing, 1 passing)
- **Our Fixed Test**: `analysisService.test.ts` - ✅ All 9 tests passing
- **Main Issues**:
  1. Most tests still use Jest syntax (`jest.mock`, `jest.fn()`, etc.)
  2. React Native import errors: `Parse failure: Expected 'from', got 'typeOf'`
  3. Missing Jest globals in vitest environment
  4. WASM module tests expect Jest environment

## Next Session Plan

### Immediate Tasks

1. **Fix Vitest Configuration**
   ```typescript
   // Update vitest.config.ts to handle React Native
   resolve: {
     alias: {
       'react-native': 'react-native-web' // or mock
     }
   }
   ```

2. **Create Jest-to-Vitest Migration Script**
   - Automatically convert `jest.` to `vi.`
   - Update imports from `@jest/globals` to `vitest`
   - Fix mock syntax differences

3. **Priority Test Fixes** (in order):
   ```
   a. Athena/__tests__/unit/services/cache/manager.test.ts (2 failing due to jest.useFakeTimers)
   b. Athena/__tests__/unit/services/fileManager.test.ts (React Native import issue)
   c. wasm-modules/bridge/__tests__/*.test.ts (all using Jest syntax)
   d. Athena/__tests__/unit/components/*.test.tsx (React Native components)
   ```

### Migration Strategy

1. **Phase 1: Core Service Tests** (Non-React Native)
   - Convert all `/services/` tests to Vitest
   - These don't depend on React Native

2. **Phase 2: WASM Module Tests**
   - Update wasm-modules tests to Vitest
   - May need separate vitest config for wasm-modules

3. **Phase 3: React Native Tests**
   - Setup proper React Native mocking for Vitest
   - Convert component tests
   - Fix integration tests

### Key Commands for Next Session

```bash
# Check current test status
cd /workspaces/Athena
npm test -- --run

# Run specific test file
npm test -- Athena/__tests__/unit/services/cache/manager.test.ts

# Check TypeScript
npm run typecheck

# Check linting
cd Athena && npm run lint
```

### Files to Reference
- `/workspaces/Athena/Athena/jest.setup.js` - Original Jest setup (for reference)
- `/workspaces/Athena/vitest.setup.js` - New Vitest setup
- `/workspaces/Athena/Athena/__tests__/unit/services/analysisService.test.ts` - Working example
- `/workspaces/Athena/Athena/services/wasm-stubs.ts` - WASM mock implementations

### Success Metrics
- All 115 test files passing
- No TypeScript errors
- No ESLint errors
- Tests run in CI/CD pipeline

## Context for AI Assistant

You are helping migrate the Athena project's test suite from Jest to Vitest. The project is a malware analysis platform with WASM integration. The main challenge is that many tests were written for Jest and need to be updated for Vitest syntax, plus React Native compatibility issues need to be resolved. Focus on systematic migration starting with the simplest tests (pure services) before tackling React Native component tests.

The previous session successfully fixed TypeScript and linting errors, and migrated one test file as a proof of concept. Now we need to scale this to all 115 test files while maintaining the same quality standards.