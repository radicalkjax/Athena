# Feature Flags Configuration

## Overview

The feature flags system in Athena provides runtime configuration of application features without requiring code changes or redeployment. This allows for:

- Gradual feature rollouts
- A/B testing
- Quick disabling of problematic features
- Performance tuning in production
- Environment-specific configurations

## Architecture

The feature flags system is implemented in `/services/config/featureFlags.ts` and integrates with the existing environment configuration system.

### Key Components

1. **FeatureFlagsService**: Central service managing all feature flags
2. **Environment Integration**: Seamless integration with existing environment config
3. **Runtime Overrides**: Development mode support for testing flags
4. **Production Control**: Environment variable based configuration

## Available Feature Flags

### Cache Features
- `enableRedisCache`: Enable/disable Redis distributed caching
- `enableMemoryCache`: Enable/disable in-memory caching
- `cacheAnalysisResults`: Enable/disable caching of analysis results

### Performance Monitoring
- `enableAPM`: Enable/disable Application Performance Monitoring
- `enablePerformanceMonitoring`: Enable/disable performance tracking

### AI Service Features
- `enableStreamingAnalysis`: Enable/disable streaming AI responses
- `enableBatchAnalysis`: Enable/disable batch processing
- `aiProviderPriority`: Array defining AI provider priority order
- `enableAIFailover`: Enable/disable automatic failover between AI providers

### Resilience Features
- `enableCircuitBreaker`: Enable/disable circuit breaker pattern
- `enableBulkhead`: Enable/disable bulkhead isolation
- `enableAdaptiveCircuitBreaker`: Enable/disable adaptive circuit breaker

### Container Features
- `enableContainerIsolation`: Enable/disable container isolation for analysis
- `enableContainerResourceLimits`: Enable/disable resource limits on containers

### Analysis Features
- `enableMetasploitIntegration`: Enable/disable Metasploit integration
- `enableLocalModels`: Enable/disable local AI models
- `enableAdvancedAnalysis`: Enable/disable advanced analysis features

### Storage Features
- `enablePersistentStorage`: Enable/disable persistent storage
- `enableDatabaseStorage`: Enable/disable database storage

## Usage

### Checking Feature Flags

```typescript
import { featureFlags } from '@/services/config/featureFlags';

// Check if a feature is enabled
if (featureFlags.isEnabled('enableRedisCache')) {
  // Use Redis cache
}

// Get all flags
const flags = featureFlags.flags;
console.log(flags.aiProviderPriority); // ['claude', 'openai', 'deepseek']
```

### Development Mode Overrides

In development mode, you can override feature flags at runtime:

```typescript
// Set an override
featureFlags.setOverride('enableAPM', true);

// Clear a specific override
featureFlags.clearOverride('enableAPM');

// Clear all overrides
featureFlags.clearAllOverrides();

// Get current overrides
const overrides = featureFlags.getOverrides();
```

Overrides are persisted in localStorage for consistency across page reloads.

### Production Configuration

In production, feature flags are controlled via environment variables:

```bash
# Enable Redis cache
export FEATURE_ENABLEREDISCACHE=true

# Set AI provider priority
export FEATURE_AIPROVIDERPRIORITY=openai,claude,deepseek

# Disable circuit breaker
export FEATURE_ENABLECIRCUITBREAKER=false
```

## Integration Points

### Circuit Breaker Factory

The circuit breaker factory checks feature flags before creating breakers:

```typescript
// Automatically falls back to standard circuit breaker if adaptive is disabled
if (!featureFlags.isEnabled('enableAdaptiveCircuitBreaker')) {
  // Use standard circuit breaker
}
```

### Cache Manager

Redis cache is only initialized if enabled:

```typescript
if (featureFlags.isEnabled('enableRedisCache')) {
  // Initialize Redis cache
}
```

### AI Service Manager

Provider priority is determined by feature flags:

```typescript
const priority = featureFlags.flags.aiProviderPriority;
// Providers are sorted based on this priority
```

## Best Practices

1. **Default Values**: Always provide sensible defaults that work in all environments
2. **Gradual Rollout**: Use feature flags to gradually enable new features
3. **Monitor Impact**: Track metrics when toggling features
4. **Document Changes**: Update `.env.example` when adding new flags
5. **Test Both States**: Always test with features both enabled and disabled

## Adding New Feature Flags

1. Add the flag to the `FeatureFlags` interface:
```typescript
export interface FeatureFlags {
  // ... existing flags
  myNewFeature: boolean;
}
```

2. Add default value in `get flags()`:
```typescript
myNewFeature: this.getFlag('myNewFeature', false),
```

3. Update `.env.example` with documentation:
```bash
# FEATURE_MYNEWFEATURE=false
```

4. Add tests for the new flag behavior

## Monitoring and Debugging

To see current feature flag configuration:

```typescript
console.log(featureFlags.toString());
```

This outputs a JSON representation of all current flag values.

## Performance Considerations

- Feature flag checks are lightweight (simple object property access)
- Overrides are cached in memory after first load
- Environment variable parsing happens once at startup
- No external dependencies or network calls

## Security Considerations

- Feature flag overrides are only available in development mode
- Production flags can only be set via environment variables
- No sensitive data should be stored in feature flags
- Flag values are not exposed to the client in production