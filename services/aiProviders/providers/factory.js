"use strict";
/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
exports.createProviderFactory = createProviderFactory;
const claude_1 = require("./claude");
const deepseek_1 = require("./deepseek");
const openai_1 = require("./openai");
const logger_1 = require("../../../utils/logger");
class ProviderFactory {
    constructor(options) {
        this.providers = new Map();
        this.configs = new Map();
        this.defaultProvider = options.defaultProvider;
        // Initialize providers
        for (const config of options.providers) {
            this.registerProvider(config);
        }
    }
    /**
     * Register a new provider
     */
    registerProvider(config) {
        try {
            const provider = this.createProvider(config);
            this.providers.set(config.type, provider);
            this.configs.set(config.type, config);
            logger_1.logger.info(`Registered AI provider: ${config.type}`, {
                model: config.model,
                endpoint: config.endpoint
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to register provider: ${config.type}`, { error });
            throw error;
        }
    }
    /**
     * Get a provider by type
     */
    getProvider(type) {
        const providerType = type || this.defaultProvider;
        if (!providerType) {
            throw new Error('No provider type specified and no default provider set');
        }
        const provider = this.providers.get(providerType);
        if (!provider) {
            throw new Error(`Provider not found: ${providerType}`);
        }
        return provider;
    }
    /**
     * Get all registered providers
     */
    getAllProviders() {
        return new Map(this.providers);
    }
    /**
     * Get provider by capabilities
     */
    getProviderByCapability(capability) {
        for (const [type, provider] of this.providers) {
            const capabilities = provider.getCapabilities();
            if (capabilities.features.includes(capability) ||
                capabilities.specializations.includes(capability)) {
                return provider;
            }
        }
        return undefined;
    }
    /**
     * Get the best provider for a specific task
     */
    getBestProviderForTask(taskType) {
        // Task-to-provider mapping based on strengths
        const taskMapping = {
            // Malware analysis tasks -> DeepSeek
            'malware_analysis': 'deepseek',
            'malware_detection': 'deepseek',
            'deobfuscation': 'deepseek',
            'binary_analysis': 'deepseek',
            'pattern_matching': 'deepseek',
            'code_deobfuscation': 'deepseek',
            // Code security tasks -> Claude
            'code_security': 'claude',
            'security_review': 'claude',
            'vulnerability_analysis': 'claude',
            'code_analysis': 'claude',
            'complex_reasoning': 'claude',
            'architecture_review': 'claude',
            // General analysis tasks -> OpenAI
            'general_analysis': 'openai',
            'report_generation': 'openai',
            'threat_intelligence': 'openai',
            'incident_response': 'openai',
            'documentation': 'openai',
            'threat_classification': 'openai'
        };
        const preferredProvider = taskMapping[taskType];
        if (preferredProvider && this.providers.has(preferredProvider)) {
            return this.providers.get(preferredProvider);
        }
        // Fallback to capability matching
        const capableProvider = this.getProviderByCapability(taskType);
        if (capableProvider) {
            return capableProvider;
        }
        // Final fallback to default provider
        return this.getProvider();
    }
    /**
     * Validate all provider configurations
     */
    validateAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = new Map();
            for (const [type, provider] of this.providers) {
                try {
                    const isValid = yield provider.validateConfig();
                    results.set(type, isValid);
                }
                catch (error) {
                    logger_1.logger.error(`Validation failed for provider: ${type}`, { error });
                    results.set(type, false);
                }
            }
            return results;
        });
    }
    /**
     * Get status of all providers
     */
    getStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const status = new Map();
            for (const [type, provider] of this.providers) {
                try {
                    const providerStatus = yield provider.getStatus();
                    status.set(type, providerStatus);
                }
                catch (error) {
                    status.set(type, {
                        available: false,
                        error: error.message
                    });
                }
            }
            return status;
        });
    }
    /**
     * Create a provider instance based on type
     */
    createProvider(config) {
        switch (config.type) {
            case 'claude':
                return new claude_1.ClaudeProvider({
                    apiKey: config.apiKey,
                    endpoint: config.endpoint,
                    model: config.model,
                    maxRetries: config.maxRetries,
                    timeout: config.timeout,
                    anthropicVersion: config.anthropicVersion,
                    anthropicBeta: config.anthropicBeta
                });
            case 'deepseek':
                return new deepseek_1.DeepSeekProvider({
                    apiKey: config.apiKey,
                    endpoint: config.endpoint,
                    model: config.model,
                    maxRetries: config.maxRetries,
                    timeout: config.timeout
                });
            case 'openai':
                return new openai_1.OpenAIProvider({
                    apiKey: config.apiKey,
                    endpoint: config.endpoint,
                    model: config.model,
                    maxRetries: config.maxRetries,
                    timeout: config.timeout,
                    organization: config.organization
                });
            default:
                throw new Error(`Unknown provider type: ${config.type}`);
        }
    }
    /**
     * Update provider configuration
     */
    updateProviderConfig(type, config) {
        const currentConfig = this.configs.get(type);
        if (!currentConfig) {
            throw new Error(`Provider not found: ${type}`);
        }
        // Merge configurations
        const newConfig = Object.assign(Object.assign(Object.assign({}, currentConfig), config), { type });
        // Recreate provider with new config
        this.registerProvider(newConfig);
    }
    /**
     * Remove a provider
     */
    removeProvider(type) {
        this.providers.delete(type);
        this.configs.delete(type);
        // Update default if needed
        if (this.defaultProvider === type) {
            this.defaultProvider = this.providers.keys().next().value;
        }
    }
}
exports.ProviderFactory = ProviderFactory;
/**
 * Create a pre-configured factory instance
 */
function createProviderFactory(env) {
    const environment = env || process.env;
    const providers = [];
    // Add Claude if configured
    if (environment.CLAUDE_API_KEY) {
        providers.push({
            type: 'claude',
            apiKey: environment.CLAUDE_API_KEY,
            model: environment.CLAUDE_MODEL || 'claude-3-opus-20240229'
        });
    }
    // Add DeepSeek if configured
    if (environment.DEEPSEEK_API_KEY) {
        providers.push({
            type: 'deepseek',
            apiKey: environment.DEEPSEEK_API_KEY,
            model: environment.DEEPSEEK_MODEL || 'deepseek-coder'
        });
    }
    // Add OpenAI if configured
    if (environment.OPENAI_API_KEY) {
        providers.push({
            type: 'openai',
            apiKey: environment.OPENAI_API_KEY,
            model: environment.OPENAI_MODEL || 'gpt-4-turbo-preview',
            organization: environment.OPENAI_ORGANIZATION
        });
    }
    if (providers.length === 0) {
        throw new Error('No AI providers configured. Please set at least one API key.');
    }
    // Determine default provider based on priority
    let defaultProvider;
    if (environment.DEFAULT_AI_PROVIDER) {
        defaultProvider = environment.DEFAULT_AI_PROVIDER;
    }
    else {
        // Default priority: Claude > OpenAI > DeepSeek
        if (providers.find(p => p.type === 'claude')) {
            defaultProvider = 'claude';
        }
        else if (providers.find(p => p.type === 'openai')) {
            defaultProvider = 'openai';
        }
        else {
            defaultProvider = providers[0].type;
        }
    }
    return new ProviderFactory({
        providers,
        defaultProvider
    });
}
