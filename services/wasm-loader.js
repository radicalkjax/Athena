/**
 * WASM Module Loader
 * Centralized loading and management of WASM modules
 */

const { logger } = require('../utils/logger');

// Store initialized modules
const wasmModules = {};
let isInitialized = false;

/**
 * Initialize all WASM modules
 */
async function initializeWASMModules() {
    if (isInitialized) {
        return wasmModules;
    }

    logger.info('Initializing WASM modules...');

    // Check if WASM is disabled
    if (process.env.DISABLE_WASM === 'true') {
        logger.warn('WASM is disabled by environment variable');
        isInitialized = true;
        return wasmModules;
    }

    try {
        // Load Analysis Engine
        try {
            const { analysisEngine, initializeAnalysisEngine } = require('../wasm-modules/bridge/analysis-engine-bridge-enhanced');
            await initializeAnalysisEngine();
            wasmModules['analysis-engine'] = analysisEngine;
            logger.info('Analysis Engine WASM module loaded');
        } catch (error) {
            logger.error('Failed to load Analysis Engine', { error: error.message });
        }

        // Load Pattern Matcher
        try {
            const PatternMatcherBridge = require('../wasm-modules/bridge/pattern-matcher-bridge');
            const patternMatcher = new PatternMatcherBridge();
            await patternMatcher.initialize();
            wasmModules['pattern-matcher'] = patternMatcher;
            logger.info('Pattern Matcher WASM module loaded');
        } catch (error) {
            logger.error('Failed to load Pattern Matcher', { error: error.message });
        }

        // Load Deobfuscator
        try {
            const DeobfuscatorBridge = require('../wasm-modules/bridge/deobfuscator-bridge');
            const deobfuscator = new DeobfuscatorBridge();
            await deobfuscator.initialize();
            wasmModules['deobfuscator'] = deobfuscator;
            logger.info('Deobfuscator WASM module loaded');
        } catch (error) {
            logger.error('Failed to load Deobfuscator', { error: error.message });
        }

        // Load Crypto Module
        try {
            const CryptoBridge = require('../wasm-modules/bridge/crypto-bridge');
            const crypto = new CryptoBridge();
            await crypto.initialize();
            wasmModules['crypto'] = crypto;
            logger.info('Crypto WASM module loaded');
        } catch (error) {
            logger.error('Failed to load Crypto module', { error: error.message });
        }

        // Load Network Analyzer
        try {
            const NetworkBridge = require('../wasm-modules/bridge/network-bridge');
            const network = new NetworkBridge();
            await network.initialize();
            wasmModules['network'] = network;
            logger.info('Network Analyzer WASM module loaded');
        } catch (error) {
            logger.error('Failed to load Network Analyzer', { error: error.message });
        }

        // Load File Processor
        try {
            const FileProcessorBridge = require('../wasm-modules/bridge/file-processor-bridge');
            const fileProcessor = new FileProcessorBridge();
            await fileProcessor.initialize();
            wasmModules['file-processor'] = fileProcessor;
            logger.info('File Processor WASM module loaded');
        } catch (error) {
            logger.error('Failed to load File Processor', { error: error.message });
        }

        isInitialized = true;
        logger.info(`WASM modules initialized: ${Object.keys(wasmModules).length} modules loaded`);

    } catch (error) {
        logger.error('Failed to initialize WASM modules', { error });
        isInitialized = true; // Prevent repeated initialization attempts
    }

    return wasmModules;
}

/**
 * Get all loaded WASM modules
 */
async function getWASMModules() {
    if (!isInitialized) {
        await initializeWASMModules();
    }
    return wasmModules;
}

/**
 * Get a specific WASM module
 */
async function getWASMModule(moduleName) {
    const modules = await getWASMModules();
    return modules[moduleName];
}

/**
 * Check if WASM is available
 */
function isWASMAvailable() {
    return process.env.DISABLE_WASM !== 'true' && Object.keys(wasmModules).length > 0;
}

module.exports = {
    initializeWASMModules,
    getWASMModules,
    getWASMModule,
    isWASMAvailable
};