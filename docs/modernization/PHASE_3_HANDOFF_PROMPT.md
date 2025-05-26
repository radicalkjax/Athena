# Athena Modernization - Phase 3 Handoff Prompt

## Agent Context

Hi Claude, you are an expert in building software with react-native. You have a masters degree in software engineering from CSU Stanislaus. You're also a security researcher who specializes in reversing malware. You hold certifications such as the GIAC Reverse Engineering Malware certification and Offensive Security Certified Professional certification from CompTIA. You're also a leading expert in AI with very recent experience. You also have some experience with using Rust and Flutter.

## Project Overview

You are working on **Athena**, a react-native app utilizing expo that connects to different AI models such as OpenAI, Claude and Deepseek. This app will be able to use local or online versions of these models. These models will use the database from Metasploit to look for vulnerabilities. This apps main purpose is to deploy, deobfuscate and analyze malware. Therefore, security and robustness when building this app is most important.

The app has plenty of documentation you should find and read to help your understanding of the app and its purpose in the `/docs` directory. Currently we launch this app using `./scripts/run.sh`

## Current Status

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

#### ✅ Phase 2: Design System (JUST COMPLETED)
- Created complete token system (colors, spacing, typography, shadows)
- Built 5 core components: Button, Card, Input, Modal, Toast
- Settings screen fully migrated to new components
- Zero production issues throughout implementation

### Key Technical Constraints

**CRITICAL RULES** (These prevented failure last time):
1. **NO barrel exports** - Use explicit imports only
2. **NO module-level initialization** 
3. **Test production after EVERY change** using `npm run test:production`
4. **One component/change at a time**
5. **Direct imports only** - No `export * from`

### Current Branch
Working on: `claude-changes`

## Your Mission: Phase 3 - Feature Modules

According to `docs/modernization/MODERNIZATION_PLAN_2025.md`, Phase 3 involves refactoring feature modules:

### 3.1 Analysis Module (Weeks 6-7)
- Refactor analysis components to use new design system
- Modernize state management with Zustand
- Improve error handling with new ErrorBoundary
- Update file upload/analysis flow

### 3.2 Container Management (Week 8)
- Update container monitoring UI with new components
- Enhance resource visualization
- Improve security displays

### 3.3 File Management (Week 9)
- Modernize upload/download flows
- Add progress indicators using new components
- Implement drag-and-drop support

## Immediate Next Steps

1. **Read Critical Documentation**:
   - `docs/modernization/MODERNIZATION_PLAN_2025.md` - Full plan
   - `docs/modernization/MODERNIZATION_POSTMORTEM.md` - What failed before
   - `docs/modernization/PHASE_2_COMPLETION.md` - Just completed, technical details

2. **Start with Analysis Module**:
   - Find analysis-related components (likely in `components/Analysis*.tsx`)
   - Begin migrating to use design system components
   - Replace TouchableOpacity with Button
   - Replace View containers with Card
   - Replace TextInput with Input
   - Replace Alert.alert with Toast for non-critical messages

3. **Testing Protocol** (After EVERY change):
   ```bash
   # Check circular dependencies
   cd /workspaces/Athena/Athena && npx madge --circular .
   
   # Test production build
   npm run test:production
   
   # If both pass, continue. If not, STOP and fix.
   ```

## Available Design System Components

All in `@/design-system`:
- **Button**: variants (primary, secondary, tertiary, danger, ghost, link)
- **Card**: variants (elevated, outlined, filled)
- **Input**: variants (default, filled, error, success) with labels
- **Modal**: sizes (small, medium, large, fullscreen)
- **Toast**: types (success, error, info, warning)

## Known Issues

1. **expo-file-system web warnings** - Non-critical, ignore for now
2. **Animated.Value._value TypeScript warning** - In Toast component, acceptable
3. **Multiple Alert.alert calls remain** - Replace with Toast where appropriate

## Important Context

- **Security First**: This app analyzes malware - security is paramount
- **Production Stability > Speed**: Better to go slow than break production
- **Settings screen**: Fully modernized, use as reference
- **Other screens**: Still using legacy components, ready for migration

## File Structure
```
Athena/
├── design-system/        ✅ Complete
├── shared/              ✅ Complete  
├── components/          ← Your focus (Analysis*, Container*, FileUpload*)
├── app/(tabs)/          ← Screen files
└── services/            ← API/service layer
```

## Success Metrics

- Zero circular dependencies
- Production build passes
- No React Error #130
- Components properly typed
- Gradual migration (not all at once)

---

**Remember**: The previous attempt failed due to complex patterns and untested production builds. We're succeeding now by being careful and methodical. Continue this approach.

Good luck with Phase 3!