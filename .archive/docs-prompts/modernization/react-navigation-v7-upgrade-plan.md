# React Navigation v7 Upgrade Plan

## Overview
Plan to upgrade React Navigation from v6 to v7 to resolve CI dependency conflicts while minimizing breaking changes.

## Analysis Summary

### ✅ Current State Assessment
- **Themes**: Already have proper `fonts` configuration ✅
- **react-native-screens**: Already v4.4.0 (meets v7 requirement) ✅  
- **expo-router usage**: Uses high-level APIs, not direct React Navigation ✅
- **No state mutations**: No direct navigation state manipulation found ✅
- **Risk Level**: LOW - The app structure is already v7-ready

### 📋 Dependency Issues Identified
1. **React Navigation conflicts**: Using v6.x but expo-router requires v7.x
2. **Deprecated packages**: `@testing-library/jest-native@5.4.3` - deprecated, use built-in matchers
3. **Version mismatches**: expo-router internally uses React Navigation v7 but project depends on v6

## Update Plan

### Phase 1: Core Navigation Update
```json
// Update these packages in package.json:
"@react-navigation/native": "^6.1.18" → "^7.1.9"
"@react-navigation/bottom-tabs": "^6.6.1" → "^7.1.5"
```

### Phase 2: Clean Up Deprecated Packages
```json
// Remove this deprecated package:
"@testing-library/jest-native": "^5.4.3" → REMOVE (from devDependencies)
```

### Phase 3: Update Test Utilities
- Update `__tests__/utils/test-utils.tsx` to remove jest-native dependency
- Use built-in matchers from @testing-library/react-native v12.4+

## Potential Breaking Changes & Mitigations

### 1. Theme Configuration ✅ Already Compatible
Current theme setup in `app/_layout.tsx` already includes required `fonts` property:
```typescript
const CustomDefaultTheme = {
  ...DefaultTheme,
  fonts: {
    regular: { fontFamily: '...', fontWeight: '400' },
    medium: { fontFamily: '...', fontWeight: '500' },
    bold: { fontFamily: '...', fontWeight: '700' },
    heavy: { fontFamily: '...', fontWeight: '900' },
  },
};
```

### 2. Navigation State Mutations ✅ Not Used
- No direct navigation state manipulation found in codebase
- App uses expo-router's declarative approach

### 3. Test Utilities ⚠️ Needs Update
File: `__tests__/utils/test-utils.tsx`
- Remove import of `@testing-library/jest-native`
- Use built-in matchers from `@testing-library/react-native`

### 4. Type Definitions ⚠️ May Need Minor Updates
- TypeScript types may need adjustment
- Monitor for type errors during compilation

## Testing Strategy

### Pre-Update Verification
```bash
npm run test          # Ensure all tests pass
npm run lint          # Check linting
npm ci                # Verify clean install works
```

### Post-Update Verification
```bash
npm install           # Install updated dependencies
npm run test          # Run full test suite
npm run lint          # Verify linting still passes
npm run start         # Test dev server
npm run build:web     # Test production build
```

### Manual Testing Checklist
- [ ] App starts without errors
- [ ] Tab navigation works (Home, About, Settings)
- [ ] Theme switching (light/dark) functions
- [ ] All screens render correctly
- [ ] No navigation-related console errors

## Rollback Plan

If critical issues arise:
```bash
# 1. Revert package.json changes
git checkout HEAD -- package.json

# 2. Clean install
npm install

# 3. If issues persist, clear cache
rm -rf node_modules package-lock.json
npm install
```

## Implementation Steps

1. **Backup current state**: Ensure git is clean
2. **Update package.json**: Apply version changes
3. **Remove deprecated package**: Remove jest-native
4. **Update test utilities**: Fix test-utils.tsx
5. **Install dependencies**: `npm install`
6. **Run verification**: Execute testing strategy
7. **Document issues**: Note any problems encountered

## Expected Outcome

- ✅ CI dependency conflicts resolved
- ✅ No breaking changes to app functionality  
- ✅ Cleaner dependency tree
- ✅ Up-to-date with expo-router requirements
- ✅ Removal of deprecated packages

## Notes

- React Navigation v7 breaking changes are minimal for this codebase
- Most changes are internal to React Navigation itself
- expo-router abstracts away most React Navigation APIs
- The app's current structure is already v7-compatible

---

**Created**: 2025-05-28
**Status**: Ready for implementation
**Risk Assessment**: LOW