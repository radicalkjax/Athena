# Athena Modernization - Phase 6 Continuation Handoff

## Agent Context

Hi Claude, you are an expert in building software with react-native. You have a masters degree in software engineering from CSU Stanislaus. You're also a security researcher who specializes in reversing malware. You hold certifications such as the GIAC Reverse Engineering Malware certification and Offensive Security Certified Professional certification from CompTIA. You're also a leading expert in AI with very recent experience. You also have some experience with using Rust and Flutter.

## Project Overview

You are working on **Athena**, a react-native app utilizing expo that connects to different AI models such as OpenAI, Claude and Deepseek. This app will be able to use local or online versions of these models. These models will use the database from Metasploit to look for vulnerabilities. This apps main purpose is to deploy, deobfuscate and analyze malware. Therefore, security and robustness when building this app is most important.

The app has plenty of documentation you should find and read to help your understanding of the app and its purpose in the `/docs` directory. Currently we launch this app using `./scripts/run.sh`

## Current Status: Phase 6 - Testing Infrastructure (In Progress)

We are in the middle of Phase 6, following the plan outlined in `/docs/modernization/MODERNIZATION_PLAN_2025.md`. 

### What Has Been Completed in Phase 6 So Far:

1. **✅ Testing Framework Setup**
   - Jest configured with `jest.config.js`
   - Dependencies installed (@testing-library/react-native, jest-when, @types/node)
   - jest.setup.js created with necessary mocks
   - Fixed @env import issues by switching to environment config

2. **✅ Test Directory Structure Created**
   ```
   __tests__/
   ├── unit/
   │   ├── store/
   │   │   └── securityStore.test.ts ✅
   │   ├── api/
   │   │   ├── gateway.test.ts ❌ (needs fixing)
   │   │   ├── errorHandler.test.ts ❌ (needs fixing)
   │   │   └── hooks.test.tsx ❌ (needs fixing)
   │   └── design-system/
   │       ├── Button.test.tsx ✅
   │       └── Card.test.tsx ✅
   ├── integration/
   ├── e2e/
   ├── fixtures/
   │   └── api-responses.ts
   └── utils/
       ├── test-utils.tsx
       ├── mock-data.ts
       └── store-utils.ts
   ```

3. **✅ Tests Written and Passing**
   - Security Store: 13/13 tests passing
   - Button Component: 9/9 tests passing
   - Card Component: 8/8 tests passing

4. **✅ Fixed Issues**
   - Removed @env imports from AIModelSelector.tsx and settings.tsx
   - Now using `import { env } from '@/shared/config/environment'` instead
   - This fixed the false API key detection issue

### What Still Needs to Be Done in Phase 6:

1. **Fix API Layer Tests** (High Priority)
   - The API tests in `__tests__/unit/api/` were written but don't match the actual implementation
   - Need to review the actual API implementation in `/services/api/` and rewrite tests
   - The actual exports are different (e.g., `APIErrorHandler` class instead of individual functions)

2. **Write AI Service Tests** (High Priority)
   - Test `/services/claude.ts`
   - Test `/services/openai.ts`
   - Test `/services/deepseek.ts`
   - These all extend the base AI service class, so test the inheritance properly

3. **Write More Design System Tests** (Medium Priority)
   - Test Input component
   - Test Modal component
   - Test Toast component

4. **Create Testing Documentation** (Low Priority)
   - Write a testing guide in `/docs/TESTING.md`
   - Document testing patterns and best practices
   - Explain how to run tests and interpret results

## Key Technical Constraints (CRITICAL)

These rules have prevented failures throughout the modernization:
1. **NO barrel exports** - Use explicit imports only
2. **NO module-level initialization**  
3. **Test production after EVERY change** using `npm run test:production`
4. **One test file at a time** - Test incrementally
5. **Direct imports only** - No `export * from`

## Important Discoveries

1. **@env Module Issues**: The `@env` module from react-native-dotenv causes babel transform errors in tests. Always use the environment config instead:
   ```typescript
   // ❌ Don't use this
   import { OPENAI_API_KEY } from '@env';
   
   // ✅ Use this instead
   import { env } from '@/shared/config/environment';
   // Then access: env.api.openai.key
   ```

2. **API Implementation**: The API layer uses an `APIErrorHandler` class, not individual exported functions. Check actual implementations before writing tests.

3. **Component Props**: Always verify actual component props before writing tests (e.g., Button uses `startIcon`/`endIcon`, not `icon`).

## Testing Protocol

After EVERY test file creation:
```bash
# Run the new test
cd /workspaces/Athena/Athena && npm test path/to/new/test.test.ts

# Check circular dependencies
cd /workspaces/Athena/Athena && npx madge --circular .

# Test production build
cd /workspaces/Athena/Athena && npm run test:production

# If all pass, continue. If not, STOP and fix.
```

## Current Todo List Status

- [x] Audit current testing infrastructure and package.json
- [x] Install testing dependencies
- [x] Configure Jest for React Native/Expo
- [x] Create test directory structure
- [x] Create test utilities and mock setup
- [x] Write security store tests (malware handling)
- [ ] Write API layer tests (CORS, error handling) - **IN PROGRESS - NEEDS FIXES**
- [x] Write design system component tests (partially done - Button & Card only)
- [ ] Write AI service tests
- [ ] Create testing documentation

## Next Immediate Steps

1. **Fix the API tests**:
   - Review `/services/api/errorHandler.ts` to understand actual exports
   - Review `/services/api/gateway.ts` for actual implementation
   - Rewrite the tests to match reality
   - The current tests assume exports that don't exist

2. **Continue with AI service tests**:
   - Start with the base AI service class test
   - Then test each specific implementation

## Commands You'll Need

```bash
# Launch the app
./scripts/run.sh

# Run specific tests
cd /workspaces/Athena/Athena && npx jest __tests__/unit/api/ --no-watchman

# Check what's actually exported from a module
cd /workspaces/Athena/Athena && grep -n "export" services/api/errorHandler.ts

# Test production build
cd /workspaces/Athena/Athena && npm run test:production

# Check circular dependencies  
cd /workspaces/Athena/Athena && npx madge --circular .
```

## Current Working Branch
You're on: `claude-changes`

## Key Files to Review

1. **Completed tests**: 
   - `/workspaces/Athena/Athena/__tests__/unit/store/securityStore.test.ts`
   - `/workspaces/Athena/Athena/__tests__/unit/design-system/*.test.tsx`

2. **Tests that need fixing**:
   - `/workspaces/Athena/Athena/__tests__/unit/api/*.test.ts`

3. **Implementation files to understand**:
   - `/workspaces/Athena/Athena/services/api/*`
   - `/workspaces/Athena/Athena/services/ai/*`

## Production Stability Status
- ✅ Zero circular dependencies maintained
- ✅ Production build working
- ✅ All completed tests passing

Good luck continuing Phase 6! Focus on fixing the API tests first, then move on to AI service tests. Remember to test incrementally and verify production stability after each change.