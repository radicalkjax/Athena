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
exports.wasmPreprocessor = void 0;
exports.initializeAIProviders = initializeAIProviders;
exports.getOrchestrator = getOrchestrator;
exports.analyzeContent = analyzeContent;
__exportStar(require("./types"), exports);
__exportStar(require("./orchestrator"), exports);
__exportStar(require("./providers"), exports);
var wasmPipeline_1 = require("./preprocessing/wasmPipeline");
Object.defineProperty(exports, "wasmPreprocessor", { enumerable: true, get: function () { return wasmPipeline_1.wasmPreprocessor; } });
const orchestrator_1 = require("./orchestrator");
const logger_1 = require("../../utils/logger");
// Global instance
let orchestratorInstance = null;
/**
 * Initialize the AI orchestrator with providers
 */
function initializeAIProviders(config) {
    return __awaiter(this, void 0, void 0, function* () {
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
            orchestratorInstance = new orchestrator_1.AIOrchestrator(providerConfig);
            logger_1.logger.info('AI providers initialized successfully');
            return orchestratorInstance;
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize AI providers', { error });
            throw error;
        }
    });
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
function analyzeContent(content, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const orchestrator = getOrchestrator();
        // Handle base64 encoding if specified in metadata
        let processedContent = content;
        if (((_b = (_a = options === null || options === void 0 ? void 0 : options.metadata) === null || _a === void 0 ? void 0 : _a.encoding) === 'base64') && typeof content === 'string') {
            processedContent = Buffer.from(content, 'base64');
        }
        const request = {
            id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: processedContent,
            analysisType: options === null || options === void 0 ? void 0 : options.analysisType,
            priority: (options === null || options === void 0 ? void 0 : options.priority) || 'normal',
            metadata: options === null || options === void 0 ? void 0 : options.metadata
        };
        return orchestrator.analyze(request, {
            type: (options === null || options === void 0 ? void 0 : options.strategy) || 'specialized'
        });
    });
}
