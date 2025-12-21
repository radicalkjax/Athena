# Athena Modernization - Phase 7 Handoff Prompt

## Context for New Agent

You are taking over the Athena project modernization at the start of **Phase 7: AI Integration Enhancement**. Athena is a cybersecurity analysis platform that performs malware analysis using multiple AI providers in isolated containers.

## Current State (Phases 0-6 Complete)

### What's Been Accomplished
1. **Foundation**: Zero circular dependencies, production build pipeline
2. **Infrastructure**: Error boundaries, logging, secure API storage
3. **Design System**: Complete UI component library with tokens
4. **UI Migration**: All components migrated to new design system
5. **Service Layer**: Modular AI services with 90% less duplication
6. **State Management**: Enhanced Zustand with middleware and security isolation
7. **API Integration**: CORS handling, API gateway, environment routing
8. **Testing**: 250+ tests, comprehensive documentation, integration tests

### Key Statistics
- **Total Tests**: 250+ across all layers
- **Code Reduction**: 42% in service layer
- **Circular Dependencies**: 0 (must maintain)
- **Production Stability**: 100% maintained throughout

## Critical Constraints (DO NOT VIOLATE)

1. **No Barrel Exports**: Use direct imports only (`import { Button } from '@/design-system/components/Button'`)
2. **No Circular Dependencies**: Check with `npx madge --circular .` after changes
3. **Test Production Build**: Run `npm run test:production` after every significant change
4. **Incremental Changes**: One feature at a time, verify stability between changes
5. **No Module-Level Code**: All initialization must happen inside React lifecycle

## Project Structure

```
Athena/
├── __tests__/              # Comprehensive test suite
│   ├── unit/              # Unit tests for all components/services
│   └── integration/       # User workflow tests
├── components/            # UI components (migrated to design system)
├── design-system/         # Reusable UI library
├── services/              # Business logic
│   ├── ai/               # Base AI service architecture
│   ├── api/              # API gateway and error handling
│   └── *.ts              # Individual service implementations
├── store/                 # Zustand state management
│   ├── slices/           # Modular store slices
│   └── middleware/       # Logger, DevTools, persistence
└── docs/
    ├── modernization/    # Phase documentation
    └── testing/          # Testing guides

```

## Key Files to Understand

1. **`/services/ai/base.ts`** - Base class for all AI services
2. **`/services/api/gateway.ts`** - Centralized API handling with CORS support
3. **`/store/securityStore.ts`** - Isolated store for sensitive malware data
4. **`/shared/config/environment.ts`** - Platform-aware configuration
5. **`/__tests__/integration/setup.ts`** - Testing utilities and mocks

## Phase 7 Objectives

### 1. Streaming Analysis Support
```typescript
// Goal: Real-time analysis updates
interface StreamingAnalysis {
  onProgress: (progress: number) => void;
  onChunk: (data: AnalysisChunk) => void;
  onComplete: (result: AnalysisResult) => void;
  onError: (error: Error) => void;
}
```

### 2. Provider Failover
```typescript
// Goal: Automatic failover between AI providers
class AIServiceManager {
  providers: AIProvider[];
  async analyzeWithFailover(file: MalwareFile): Promise<AnalysisResult>;
}
```

### 3. Enhanced Progress Reporting
- Granular progress updates during analysis
- Time estimates based on file size/complexity
- Resource usage monitoring
- User-friendly status messages

### 4. Circuit Breaker Pattern
- Prevent cascading failures
- Automatic recovery after provider issues
- Health checks for each provider

## Commands You'll Need

```bash
# Development
cd /workspaces/Athena/Athena
npm run dev

# Testing
npm test                          # Run all tests
npx jest path/to/test            # Run specific test
npm run test:coverage            # Coverage report
npm run test:production          # Verify production build

# Code Quality
npx madge --circular .           # Check circular deps (MUST BE 0)
npm run lint                     # ESLint
npm run typecheck               # TypeScript

# Build
npm run build                    # Production build
```

## Current Challenges

1. **FileUploader Tests**: Some component tests have timing issues
2. **Provider Rate Limits**: Need intelligent request management
3. **Large File Analysis**: Memory optimization needed
4. **Progress Granularity**: Current progress reporting is basic

## Best Practices Established

1. **Mock at Module Level**: Jest mocks before imports
2. **Platform Detection**: Use `typeof document !== 'undefined'` for web checks
3. **Secure Storage**: Never persist API keys in store
4. **Error Messages**: User-friendly with actionable solutions
5. **Type Safety**: Strict TypeScript, no `any` unless necessary

## Next Steps

1. **Review Phase 6 Completion**: Read `/docs/modernization/PHASE_6_COMPLETION.md`
2. **Understand AI Services**: Study `/services/ai/base.ts` and implementations
3. **Plan Streaming**: Design streaming architecture that works with all providers
4. **Implement Failover**: Start with simple round-robin, evolve to smart routing
5. **Test Everything**: Maintain or increase the 250+ test count

## Important Notes

- **CORS Issues**: Already handled by API Gateway, use the established patterns
- **Environment Variables**: Use `@/shared/config/environment` not `@env`
- **Store Updates**: Always test persistence doesn't leak sensitive data
- **Production First**: If it works in dev but not prod, it doesn't work

## Success Metrics for Phase 7

- [ ] Streaming updates during analysis (< 100ms latency)
- [ ] Automatic failover between providers (< 2s switch time)
- [ ] Circuit breaker prevents cascade failures
- [ ] Progress reporting accurate to ±5%
- [ ] All existing tests still pass
- [ ] 20+ new tests for streaming/failover
- [ ] Zero circular dependencies maintained
- [ ] Production build remains stable

## Resources

- Testing Docs: `/docs/testing/` - Comprehensive testing guides
- Modernization History: `/docs/modernization/PHASE_*_COMPLETION.md`
- Design Patterns: `/docs/testing/patterns.md`
- Troubleshooting: `/docs/testing/troubleshooting.md`

---

**Your Mission**: Implement Phase 7 (AI Integration Enhancement) while maintaining the stability and quality established in Phases 0-6. The foundation is solid - build upon it carefully.

Good luck! The codebase is in excellent shape and ready for these enhancements.