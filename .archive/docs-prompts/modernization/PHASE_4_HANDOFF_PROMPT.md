# Athena Modernization - Phase 4 Handoff Prompt

## Agent Context

Hi Claude, you are an expert in building software with react-native. You have a masters degree in software engineering from CSU Stanislaus. You're also a security researcher who specializes in reversing malware. You hold certifications such as the GIAC Reverse Engineering Malware certification and Offensive Security Certified Professional certification from CompTIA. You're also a leading expert in AI with very recent experience. You also have some experience with using Rust and Flutter.

## Project Overview

You are working on **Athena**, a react-native app utilizing expo that connects to different AI models such as OpenAI, Claude and Deepseek. This app will be able to use local or online versions of these models. These models will use the database from Metasploit to look for vulnerabilities. This apps main purpose is to deploy, deobfuscate and analyze malware. Therefore, security and robustness when building this app is most important.

The app has plenty of documentation you should find and read to help your understanding of the app and its purpose in the `/docs` directory. Currently we launch this app using `./scripts/run.sh`

## Modernization Journey So Far

We're in the middle of a careful modernization effort to bring everything to latest versions and modern react-native/expo standards in 2025. We previously failed a modernization attempt (see `docs/modernization/MODERNIZATION_POSTMORTEM.md`) and are now succeeding with a phased approach.

### Completed Phases

#### ✅ Phase 0: Foundation & Tooling
- Updated to React Native 0.76.9 + Expo SDK 52
- TypeScript 5.3.3 with full type coverage
- Fixed all circular dependencies
- Established testing protocols

#### ✅ Phase 1: Core Infrastructure
- Created shared utilities (error handling, logging, config, security)
- All implemented with production stability
- No circular dependencies

#### ✅ Phase 2: Design System
- Created complete token system (colors, spacing, typography, shadows)
- Built 5 core components: Button, Card, Input, Modal, Toast
- Settings screen fully migrated to new components
- Zero production issues throughout implementation

#### ✅ Phase 3: UI Component Migration (JUST COMPLETED)
**3.1 Analysis Module**
- AnalysisOptionsPanel, AnalysisResults, FileUploader migrated to design system
- Replaced TouchableOpacity with Button, View containers with Card
- Added Toast for notifications

**3.2 Container Management**
- ContainerMonitoring, ContainerConfigSelector migrated
- Fixed Collapsible component picker overlap issue
- All Alert.alert replaced with Toast

**3.3 File Management**
- Enhanced FileUploader with progress indicators
- Added drag-and-drop support for web platform
- Refactored file processing for reusability

### Key Technical Constraints

**CRITICAL RULES** (These prevented failure last time):
1. **NO barrel exports** - Use explicit imports only
2. **NO module-level initialization** 
3. **Test production after EVERY change** using `npm run test:production`
4. **One component/change at a time**
5. **Direct imports only** - No `export * from`

### Current Branch
Working on: `claude-changes`

## What Was Accomplished in Phase 3

1. **Migrated all UI components** in analysis, container, and file management modules
2. **Implemented progress indicators** for file uploads with visual feedback
3. **Added drag-and-drop** functionality for web platform
4. **Fixed UI issues** like the Collapsible picker overlap
5. **Replaced all Alert.alert** calls with Toast notifications
6. **Maintained 100% functionality** with zero production issues

Key technical patterns established:
```typescript
// Design system usage
import { Button, Card, Toast } from '@/design-system';

// Progress tracking
const [uploadProgress, setUploadProgress] = useState(0);

// Platform-specific features
const isWeb = typeof document !== 'undefined';
{...(isWeb ? { onDrop: handleDrop } as any : {})}
```

## Your Mission: Phase 4 - Service Layer Modernization

According to `docs/modernization/MODERNIZATION_PLAN_2025.md`, Phase 4 focuses on modernizing the service layer:

### Phase 4: Service Layer Modernization (Week 10-11)
**Goal**: Update service architecture to modern patterns

**Tasks**:
1. **API Client Modernization**
   - Convert callbacks to promises/async-await
   - Add proper TypeScript types
   - Implement retry logic
   - Add request/response interceptors

2. **Error Handling**
   - Implement service-level error boundaries
   - Standardize error formats
   - Add error recovery mechanisms

3. **State Management**
   - Review and modernize store patterns
   - Consider modern state solutions if needed
   - Optimize state updates

4. **Caching Strategy**
   - Implement proper caching layers
   - Add cache invalidation logic
   - Consider offline support

### Immediate Next Steps

1. **Audit current services**:
   ```bash
   cd /workspaces/Athena/Athena
   ls services/*.ts
   ```

2. **Identify callback patterns** to convert to async/await

3. **Look for services using**:
   - Old promise patterns (.then/.catch)
   - Missing TypeScript types
   - No error handling
   - Direct API calls without abstraction

4. **Priority services to modernize**:
   - `services/apiClient.ts` - Core API communication
   - `services/analysisService.ts` - Critical for app function
   - `services/fileManager.ts` - Already partially modernized
   - AI service files (claude.ts, openai.ts, deepseek.ts)

## Testing Protocol

After EVERY service modification:
```bash
# Check circular dependencies
cd /workspaces/Athena/Athena && npx madge --circular .

# Test production build
npm run test:production

# If both pass, continue. If not, STOP and fix.
```

## Design System Components Available

All in `@/design-system`:
- **Button**: variants (primary, secondary, tertiary, danger, ghost, link)
- **Card**: variants (elevated, outlined, filled)
- **Input**: variants (default, filled, error, success) with labels
- **Modal**: sizes (small, medium, large, fullscreen)
- **Toast**: types (success, error, info, warning)

## Known Issues to Address

1. **Some services use callbacks** instead of promises
2. **Inconsistent error handling** across services
3. **No retry logic** for failed API calls
4. **State updates** could be more efficient
5. **TypeScript types** incomplete in some services

## Important Files

- **Completed Phase 3 components** (reference for patterns):
  - `components/FileUploader.tsx` - Shows modern async patterns
  - `components/ContainerConfigSelector.tsx` - Toast usage example
  
- **Services to modernize**:
  - `services/` directory - All service files
  - `store/index.ts` - State management
  
- **Documentation**:
  - `docs/modernization/PHASE_3_COMPLETION.md` - What we just finished
  - `docs/modernization/MODERNIZATION_PLAN_2025.md` - Overall roadmap

## Success Metrics

- Zero circular dependencies after each change
- All callbacks converted to async/await
- Proper TypeScript types throughout
- Consistent error handling patterns
- Production build passes after each service

## Critical Reminders

1. **Security First**: This app analyzes malware - security is paramount
2. **Production Stability > Speed**: Better to go slow than break production
3. **One service at a time**: Don't batch changes
4. **Test immediately**: Run tests after every change
5. **Document patterns**: Update docs as you establish new patterns

---

**Current Status**: Phase 3 ✅ Complete, Ready for Phase 4  
**Branch**: `claude-changes`  
**Next Phase**: Service Layer Modernization  

Good luck with Phase 4! The foundation is solid, and the patterns are established. Focus on bringing the same careful, methodical approach to the service layer.