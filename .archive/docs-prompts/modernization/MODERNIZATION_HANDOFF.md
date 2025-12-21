# Athena Modernization - Handoff Document

## Project Context

You are working on **Athena**, a React Native app using Expo that connects to different AI models (OpenAI, Claude, DeepSeek) for malware analysis. The app's main purpose is to deploy, deobfuscate, and analyze malware with security and robustness as top priorities.

### Your Role
You are an expert in building software with React Native, with:
- Masters degree in software engineering from CSU Stanislaus
- Security researcher specializing in reverse engineering malware
- GIAC Reverse Engineering Malware certification
- Offensive Security Certified Professional certification
- Leading expert in AI with recent experience
- Experience with Rust and Flutter

### Current Technology Stack
- **React Native**: 0.76.9 (Latest stable)
- **Expo SDK**: 52.0.43 (Latest)
- **React**: 18.3.1
- **TypeScript**: 5.3.3
- **State Management**: Zustand 4.5.0
- **Database**: PostgreSQL with Sequelize ORM
- **Launch Method**: `./scripts/run.sh`

## Modernization Progress

### What We've Completed

#### ✅ Phase 0: Foundation & Tooling (100% Complete)
1. **Installed Analysis Tools**:
   - madge (circular dependency detection)
   - webpack-bundle-analyzer
   - source-map-explorer  
   - size-limit (bundle size monitoring)

2. **Created Configurations**:
   - `webpack.config.debug.js` - Debug production builds
   - `.madgerc` - Circular dependency config
   - `.size-limit.json` - Bundle size limits
   - `.github/workflows/production-build.yml` - CI/CD pipeline

3. **Added npm Scripts**:
   ```json
   "analyze:deps": "madge --circular ./",
   "analyze:bundle": "npm run build:web && source-map-explorer dist/static/js/*.js",
   "build:debug": "expo export --platform web --webpack-config webpack.config.debug.js",
   "test:production": "node ./scripts/test-production-build.js"
   ```

#### ✅ Pre-Phase 1: Dependency Cleanup
- **Replaced react-emojis** (required React 16) with custom Emoji component using Unicode
- Created `/components/Emoji.tsx`
- No more React version conflicts

#### ✅ Phase 1: Core Infrastructure (100% Complete)
1. **Error Boundaries & Logging**:
   - `/shared/error-handling/ErrorBoundary.tsx` - Comprehensive error handling
   - `/shared/logging/logger.ts` - Structured logging system
   - Integrated ErrorBoundary in root `_layout.tsx`

2. **Environment Configuration**:
   - `/shared/config/environment.ts` - Centralized config management
   - Platform detection, API configs, feature flags, security settings

3. **Secure Storage**:
   - `/shared/security/SecureStorage.ts` - Platform-appropriate API key storage
   - Uses expo-secure-store for native, encrypted localStorage for web

4. **Clean Exports**:
   - `/shared/index.ts` - Central export point for all shared modules

### Current Status
- ✅ No circular dependencies
- ✅ Production build working
- ✅ App launches correctly with all new infrastructure
- ✅ Full TypeScript coverage on new code

## Next Steps: Phase 2 - Design System (Weeks 4-5)

### Immediate Tasks
Following the plan in `/docs/modernization/MODERNIZATION_PLAN_2025.md`:

#### 2.1 Design Tokens
Create `/design-system/tokens/`:
```typescript
// colors.ts - Include semantic colors for malware threat levels
// spacing.ts - Consistent spacing scale
// typography.ts - Font sizes and weights
// shadows.ts - Elevation system
```

#### 2.2 Base Components (One at a time!)
**Critical**: Test production build after EACH component

1. Start with Button component:
   - Create `/design-system/components/Button.tsx`
   - Use in ONE place (e.g., Settings screen)
   - Run `npm run test:production`
   - If successful, gradually replace other buttons

2. Then proceed with:
   - Card
   - Input
   - Modal
   - Toast

### Migration Strategy
1. Create new component alongside old
2. Use feature flag to switch:
   ```typescript
   const Button = featureFlags.useModernButton ? ButtonModern : ButtonLegacy;
   ```
3. Test in production
4. Monitor for issues
5. Remove legacy only after validation

## Important Lessons from Previous Attempt

From `/docs/modernization/MODERNIZATION_POSTMORTEM.md`:

### What Failed Before
- **React Error #130**: Undefined component in production (but worked in dev)
- **Cause**: Complex provider hierarchies and module-level initialization
- **Solution**: Keep it simple, test production after EVERY change

### Rules to Follow
1. **NO barrel exports** (avoid `export * from './components'`)
2. **NO module-level initialization**
3. **Test production build after EVERY component**
4. **Direct imports only**
5. **Minimal provider nesting**

## Testing Protocol

After EVERY change:
```bash
# 1. Check circular dependencies
npm run analyze:deps

# 2. Test production build
npm run test:production

# 3. Check bundle size
npx size-limit

# 4. If all pass, commit with clear message
git add .
git commit -m "Add Button component to design system"
```

## File Structure
```
Athena/
├── shared/                    # ✅ Phase 1 (Complete)
│   ├── error-handling/
│   ├── logging/
│   ├── config/
│   └── security/
├── design-system/            # 🚧 Phase 2 (Next)
│   ├── tokens/
│   └── components/
├── components/               # Existing components
└── app/                     # Expo Router screens
```

## Key Commands Reference
```bash
# Development
./scripts/run.sh              # Start the app

# Analysis
npm run analyze:deps          # Check circular dependencies
npm run analyze:bundle        # Analyze bundle composition
npm run build:debug          # Debug production build

# Testing
npm run test:production      # Comprehensive production test
```

## Documentation References
- **Original Plan**: `/docs/modernization/MODERNIZATION_PLAN_2025.md`
- **Previous Attempt Issues**: `/docs/modernization/MODERNIZATION_POSTMORTEM.md`
- **Phase 0 Report**: `/docs/modernization/PHASE_0_COMPLETION.md`
- **Phase 1 Report**: `/docs/modernization/PHASE_1_COMPLETION.md`
- **Progress Tracker**: `/docs/modernization/MODERNIZATION_PROGRESS.md`

## Critical Reminders
1. **Security First**: This app analyzes malware - security is paramount
2. **Production Stability**: Test production after EVERY change
3. **Incremental Progress**: One component at a time
4. **Document Everything**: Update progress tracker regularly
5. **No Surprises**: If production build fails, STOP and fix immediately

## Current Branch
Working on: `claude-changes`

---

**Your Mission**: Continue with Phase 2 (Design System) following the incremental approach. Start with design tokens, then create the Button component, test it thoroughly in production, and only then proceed to the next component. Remember: production stability is more important than speed.