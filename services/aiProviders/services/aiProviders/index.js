"use strict";
/**
 * AI Provider Service
 * Main entry point for AI provider integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wasmPreprocessor = exports.AIOrchestrator = exports.OrchestrationError = exports.AIProviderError = void 0;
exports.initializeAIProviders = initializeAIProviders;
exports.getOrchestrator = getOrchestrator;
exports.analyzeContent = analyzeContent;
// Export all types except the ones that conflict
var types_1 = require("./types");
Object.defineProperty(exports, "AIProviderError", { enumerable: true, get: function () { return types_1.AIProviderError; } });
Object.defineProperty(exports, "OrchestrationError", { enumerable: true, get: function () { return types_1.OrchestrationError; } });
// Export orchestrator class but not the conflicting interface
var orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "AIOrchestrator", { enumerable: true, get: function () { return orchestrator_1.AIOrchestrator; } });
__exportStar(require("./providers"), exports);
var wasmPipeline_1 = require("./preprocessing/wasmPipeline");
Object.defineProperty(exports, "wasmPreprocessor", { enumerable: true, get: function () { return wasmPipeline_1.wasmPreprocessor; } });
const orchestrator_2 = require("./orchestrator");
const logger_1 = require("../../utils/logger");
// Global instance
let orchestratorInstance = null;
/**
 * Initialize the AI orchestrator with providers
 */
async function initializeAIProviders(config) {
    try {
        // Use config or environment variables
        const providerConfig = config || {
            claude: {
                apiKey: process.env.CLAUDE_API_KEY,
                model: process.env.CLAUDE_MODEL
            },
            deepseek: {
                apiKey: process.env.DEEPSEEK_API_KEY,
                model: process.env.DEEPSEEK_MODEL
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_MODEL,
                organization: process.env.OPENAI_ORGANIZATION
            }
        };
        // Create orchestrator
        orchestratorInstance = new orchestrator_2.AIOrchestrator(providerConfig);
        logger_1.logger.info('AI providers initialized successfully');
        return orchestratorInstance;
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize AI providers', { error });
        throw error;
    }
}
/**
 * Get the current orchestrator instance
 */
function getOrchestrator() {
    if (!orchestratorInstance) {
        throw new Error('AI providers not initialized. Call initializeAIProviders() first.');
    }
    return orchestratorInstance;
}
/**
 * Helper function to analyze content with best defaults
 */
async function analyzeContent(content, options) {
    const orchestrator = getOrchestrator();
    const request = {
        id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        analysisType: options?.analysisType,
        priority: options?.priority || 'normal',
        metadata: options?.metadata
    };
    return orchestrator.analyze(request, {
        type: options?.strategy || 'specialized'
    });
}
