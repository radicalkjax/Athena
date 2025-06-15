"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcherBridge = void 0;
exports.getPatternMatcher = getPatternMatcher;
exports.decodeMatchedData = decodeMatchedData;
exports.matchedDataToString = matchedDataToString;
// Dynamic imports - will be loaded based on platform
let WasmPatternMatcher;
let StreamingScanner;
let Stats;
class PatternMatcherBridge {
    constructor() {
        this.initialized = false;
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Platform-specific loading
            let wasmModule;
            if (typeof window !== 'undefined') {
                // Browser environment
                wasmModule = await Promise.resolve().then(() => __importStar(require('../core/pattern-matcher/pkg-web/pattern_matcher')));
                await wasmModule.default();
            }
            else {
                // Node.js environment - pattern-matcher doesn't have pkg-node yet, use pkg
                wasmModule = require('../core/pattern-matcher/pkg/pattern_matcher');
            }
            this.wasmModule = wasmModule;
            WasmPatternMatcher = wasmModule.PatternMatcher;
            StreamingScanner = wasmModule.StreamingScanner;
            Stats = wasmModule.Stats;
            this.matcher = new WasmPatternMatcher();
            await this.matcher.load_default_rules();
            this.initialized = true;
            console.log('PatternMatcher WASM module initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize PatternMatcher WASM module:', error);
            throw new Error(`PatternMatcher initialization failed: ${error}`);
        }
    }
    async scan(data) {
        if (!this.initialized || !this.matcher) {
            await this.initialize();
        }
        try {
            const uint8Array = new Uint8Array(data);
            const result = await this.matcher.scan(uint8Array);
            return result;
        }
        catch (error) {
            console.error('Pattern scanning failed:', error);
            throw new Error(`Scan failed: ${error}`);
        }
    }
    async addRule(ruleText) {
        if (!this.initialized || !this.matcher) {
            await this.initialize();
        }
        try {
            const ruleId = await this.matcher.add_rule_text(ruleText);
            return ruleId;
        }
        catch (error) {
            console.error('Failed to add rule:', error);
            throw new Error(`Add rule failed: ${error}`);
        }
    }
    async addRules(rules) {
        // Convert rules to YARA-like format and add them
        for (const rule of rules) {
            const yaraRule = this.convertToYaraFormat(rule);
            await this.addRule(yaraRule);
        }
    }
    convertToYaraFormat(rule) {
        let yaraRule = `rule ${rule.name}\n{\n`;
        // Add metadata
        if (rule.tags.length > 0 || rule.metadata) {
            yaraRule += '  meta:\n';
            yaraRule += `    description = "${rule.description}"\n`;
            yaraRule += `    severity = "${rule.severity}"\n`;
            yaraRule += `    category = "${rule.category}"\n`;
            if (rule.tags.length > 0) {
                yaraRule += `    tags = "${rule.tags.join(', ')}"\n`;
            }
        }
        // Add patterns
        yaraRule += '  strings:\n';
        for (const pattern of rule.patterns) {
            yaraRule += `    $${pattern.id} = `;
            switch (pattern.pattern_type) {
                case 'Exact':
                    yaraRule += `"${pattern.value}"\n`;
                    break;
                case 'Regex':
                    yaraRule += `/${pattern.value}/\n`;
                    break;
                case 'Binary':
                    if (pattern.value instanceof Uint8Array) {
                        const hexString = Array.from(pattern.value)
                            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                            .join(' ');
                        yaraRule += `{ ${hexString} }\n`;
                    }
                    break;
            }
        }
        // Add condition
        yaraRule += '  condition:\n';
        yaraRule += `    ${this.conditionToString(rule.condition)}\n`;
        yaraRule += '}\n';
        return yaraRule;
    }
    conditionToString(condition) {
        if ('type' in condition) {
            switch (condition.type) {
                case 'All':
                    return 'all of them';
                case 'Any':
                    return `any of them`;
                case 'PatternRef':
                    return `$${condition.pattern_id}`;
                case 'And':
                    return condition.conditions.map(c => this.conditionToString(c)).join(' and ');
                case 'Or':
                    return condition.conditions.map(c => this.conditionToString(c)).join(' or ');
                case 'Not':
                    return `not ${this.conditionToString(condition.condition)}`;
            }
        }
        return 'all of them';
    }
    async *scanStreaming(stream, chunkSize = 1024 * 1024) {
        if (!this.initialized) {
            await this.initialize();
        }
        const scanner = new this.wasmModule.StreamingScanner(chunkSize);
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    const finalResult = await scanner.finish();
                    if (finalResult) {
                        yield finalResult;
                    }
                    break;
                }
                const result = await scanner.process_chunk(value);
                if (result) {
                    yield result;
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    getRuleCount() {
        if (!this.initialized || !this.matcher) {
            throw new Error('PatternMatcher not initialized');
        }
        return this.matcher.get_rule_count();
    }
    getStats() {
        if (!this.initialized || !this.matcher) {
            throw new Error('PatternMatcher not initialized');
        }
        const stats = this.matcher.get_stats();
        return {
            total_scans: stats.total_scans,
            total_matches: stats.total_matches,
            average_scan_time_ms: stats.average_scan_time_ms,
            throughput_mbps: stats.throughput_mbps
        };
    }
    clearRules() {
        if (!this.initialized || !this.matcher) {
            throw new Error('PatternMatcher not initialized');
        }
        this.matcher.clear_rules();
    }
    destroy() {
        if (this.matcher) {
            this.matcher.free();
            this.matcher = undefined;
        }
        this.initialized = false;
    }
}
exports.PatternMatcherBridge = PatternMatcherBridge;
// Singleton instance
let patternMatcherInstance = null;
function getPatternMatcher() {
    if (!patternMatcherInstance) {
        patternMatcherInstance = new PatternMatcherBridge();
    }
    return patternMatcherInstance;
}
// Helper function to decode base64 matched data
function decodeMatchedData(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
// Helper function to convert matched data to string
function matchedDataToString(base64) {
    const bytes = decodeMatchedData(base64);
    return new TextDecoder().decode(bytes);
}
