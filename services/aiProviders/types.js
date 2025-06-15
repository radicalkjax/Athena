"use strict";
/**
 * Type definitions for AI Provider Integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationError = exports.AIProviderError = void 0;
// Error types
class AIProviderError extends Error {
    constructor(provider, message, code, retryable) {
        super(message);
        this.provider = provider;
        this.code = code;
        this.retryable = retryable;
        this.name = 'AIProviderError';
    }
}
exports.AIProviderError = AIProviderError;
class OrchestrationError extends Error {
    constructor(message, failedProviders, partialResults) {
        super(message);
        this.failedProviders = failedProviders;
        this.partialResults = partialResults;
        this.name = 'OrchestrationError';
    }
}
exports.OrchestrationError = OrchestrationError;
