# Athena Modernization - Phase 4 Continuation Prompt

## Agent Context

Hi Claude, you are an expert in building software with react-native. You have a masters degree in software engineering from CSU Stanislaus. You're also a security researcher who specializes in reversing malware. You hold certifications such as the GIAC Reverse Engineering Malware certification and Offensive Security Certified Professional certification from CompTIA. You're also a leading expert in AI with very recent experience. You also have some experience with using Rust and Flutter.

## Project Overview

You are working on **Athena**, a react-native app utilizing expo that connects to different AI models such as OpenAI, Claude and Deepseek. This app will be able to use local or online versions of these models. These models will use the database from Metasploit to look for vulnerabilities. This apps main purpose is to deploy, deobfuscate and analyze malware. Therefore, security and robustness when building this app is most important.

The app has plenty of documentation you should find and read to help your understanding of the app and its purpose in the `/docs` directory. Currently we launch this app using `./scripts/run.sh`

## Modernization Journey - Current Status

We're in the middle of Phase 4 (Service Layer Modernization) of a careful modernization effort. Previous phases have been completed successfully:

### ✅ Completed Phases
- **Phase 0**: Foundation & Tooling (React Native 0.76.9 + Expo SDK 52)
- **Phase 1**: Core Infrastructure (shared utilities with production stability)
- **Phase 2**: Design System (complete token system and 5 core components)
- **Phase 3**: UI Component Migration (all UI components migrated to design system)

### 🚧 Phase 4: Service Layer Modernization (IN PROGRESS)

#### What's Been Completed in Phase 4:

1. **✅ Service Audit** - Identified all modernization needs:
   - Callback patterns to convert
   - Missing TypeScript types
   - Inconsistent error handling
   - No retry logic for API calls

2. **✅ Modernized `apiClient.ts`**:
   - Added global TypeScript declaration for `__DEV__`
   - Implemented retry logic with exponential backoff and jitter
   - Added request cancellation support (`cancelRequest`, `cancelAllRequests`)
   - Improved type safety (replaced `any` with `unknown`)
   - Created `createBearerTokenClient` factory function
   - Added `RetryConfig` interface with customizable retry behavior
   - All API client creators now use the factory pattern

3. **✅ Fixed Critical UI Bugs**:
   - Fixed file upload getting stuck at 90% progress
   - Fixed Toast component color and shadow errors
   - Fixed `useNativeDriver` warning for web platform
   - File uploads now work correctly with proper state management

4. **✅ Modernized `analysisService.ts`**:
   - Created proper TypeScript interfaces:
     - `DeobfuscationResult`
     - `VulnerabilityAnalysisResult`
     - `NetworkActivity`
     - `FileActivity`
     - `ContainerAnalysisResults`
   - Replaced `setTimeout` with promise-based `delay` function
   - Implemented `AnalysisError` class for consistent error handling
   - Added `handleError` utility function
   - Fixed incorrect function references
   - Improved type safety throughout

#### What Still Needs to Be Done in Phase 4:

1. **🔄 Modernize AI Service Files** (claude.ts, openai.ts, deepseek.ts):
   - Major code duplication between files (90%+ identical)
   - Need to create base AI service class/interface
   - Extract common API key management
   - Consolidate system prompts
   - Fix missing variable declarations (`cachedBaseUrl` in claude.ts)
   - Remove `localStorage` usage (not available in React Native)
   - Create proper TypeScript interfaces for API responses

2. **📝 Review fileManager.ts**:
   - Already partially modernized
   - May need additional improvements

3. **🔧 Implement Service-Level Error Handling Patterns**:
   - Standardize error types across all services
   - Create error recovery mechanisms
   - Add proper error context

4. **📊 Review State Management** (store/index.ts):
   - Check for optimization opportunities
   - Consider modern state patterns if needed

5. **📚 Document New Service Patterns**:
   - Document retry configuration
   - Document error handling patterns
   - Create service usage examples

### Key Technical Constraints (CRITICAL)

These rules prevented failure in previous attempts:
1. **NO barrel exports** - Use explicit imports only
2. **NO module-level initialization**
3. **Test production after EVERY change** using `npm run test:production`
4. **One component/service at a time**
5. **Direct imports only** - No `export * from`

### Testing Protocol

After EVERY service modification:
```bash
# Check circular dependencies
cd /workspaces/Athena/Athena && npx madge --circular .

# Test production build
npm run test:production

# If both pass, continue. If not, STOP and fix.
```

### Current Branch
Working on: `claude-changes`

## Immediate Next Steps

1. **Create Base AI Service Class/Interface**:
   - Extract common functionality from claude.ts, openai.ts, deepseek.ts
   - Create shared interfaces for API responses
   - Implement common error handling
   - Consolidate API key management

2. **Example of Duplication to Fix**:
   ```typescript
   // Currently duplicated in all 3 AI services:
   - initClaude/initOpenAI/initDeepSeek (90% identical)
   - deobfuscateCode functions (95% identical)
   - analyzeVulnerabilities functions (95% identical)
   - API key management (85% identical)
   - System prompts (100% identical)
   ```

3. **Suggested Approach**:
   - Create `services/ai/base.ts` with abstract class or interface
   - Create `services/ai/types.ts` for shared types
   - Create `services/ai/prompts.ts` for system prompts
   - Refactor individual AI services to extend/implement base

## Important Context

- **Security First**: This app analyzes malware - all code must be secure
- **Production Stability**: Better to go slow than break production
- **File Upload Fix**: Previously stuck at 90%, now working after fixing loading state management
- **Toast Fix**: Was throwing errors due to incorrect color paths, now using `colors.semantic.*`

## Design System Available

All components in `@/design-system`:
- Button, Card, Input, Modal, Toast
- Complete token system (colors, spacing, typography, shadows)
- Platform-specific handling for web vs native

## Known Issues to Watch For

1. **Platform Differences**: Some features like `localStorage` don't work in React Native
2. **Animated Warnings**: Use `Platform.OS !== 'web'` for `useNativeDriver`
3. **TypeScript Strictness**: Ensure all types are properly defined
4. **Async/Await**: All services should use modern promise patterns

## Success Metrics

- ✅ Zero circular dependencies
- ✅ All callbacks converted to async/await
- ✅ Proper TypeScript types throughout
- ✅ Consistent error handling
- ✅ Production build passes
- ✅ No code duplication in AI services

---

**Current Status**: Phase 4 in progress, apiClient.ts and analysisService.ts modernized
**Next Task**: Modernize AI service files to eliminate duplication
**Branch**: `claude-changes`

Good luck continuing the modernization!