/**
 * WASM Analysis API Endpoints
 * Direct WASM module access for high-performance analysis
 */

const { Router } = require('express');
const { logger } = require('../../../utils/logger');
const { getWASMModules } = require('../../wasm-loader');

const router = Router();

// Authentication middleware
function authenticateRequest(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    next();
}

/**
 * Analyze file using WASM modules directly
 * POST /api/v1/wasm/analyze
 */
router.post('/analyze', authenticateRequest, async (req, res) => {
    try {
        const { content, module = 'analysis-engine', operation = 'analyze', options = {} } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Get WASM modules
        const wasmModules = await getWASMModules();
        
        if (!wasmModules[module]) {
            return res.status(404).json({ 
                error: 'WASM module not found',
                availableModules: Object.keys(wasmModules)
            });
        }

        // Convert base64 content to buffer if needed
        let processedContent = content;
        if (options.encoding === 'base64') {
            processedContent = Buffer.from(content, 'base64');
        }

        // Execute WASM operation
        const startTime = Date.now();
        let result;

        switch (module) {
            case 'analysis-engine':
                result = await analyzeWithEngine(wasmModules[module], processedContent, options);
                break;
            
            case 'pattern-matcher':
                result = await matchPatterns(wasmModules[module], processedContent, options);
                break;
            
            case 'deobfuscator':
                result = await deobfuscate(wasmModules[module], processedContent, options);
                break;
            
            case 'crypto':
                result = await analyzeCrypto(wasmModules[module], processedContent, options);
                break;
            
            case 'network':
                result = await analyzeNetwork(wasmModules[module], processedContent, options);
                break;
            
            case 'file-processor':
                result = await processFile(wasmModules[module], processedContent, options);
                break;
            
            default:
                return res.status(400).json({ error: 'Invalid module specified' });
        }

        const executionTime = Date.now() - startTime;

        res.json({
            module,
            operation,
            executionTime,
            result
        });

    } catch (error) {
        logger.error('WASM analysis failed', { error });
        res.status(500).json({
            error: 'WASM analysis failed',
            message: error.message
        });
    }
});

/**
 * Get WASM module capabilities
 * GET /api/v1/wasm/capabilities
 */
router.get('/capabilities', authenticateRequest, async (req, res) => {
    try {
        const wasmModules = await getWASMModules();
        
        const capabilities = {
            'analysis-engine': {
                description: 'Core malware analysis engine',
                operations: ['analyze', 'quick_scan', 'deep_scan'],
                version: wasmModules['analysis-engine']?.get_version?.() || 'unknown'
            },
            'pattern-matcher': {
                description: 'Pattern and signature matching',
                operations: ['match', 'scan', 'check_signatures'],
                supportedPatterns: ['yara', 'regex', 'binary']
            },
            'deobfuscator': {
                description: 'Code deobfuscation',
                operations: ['deobfuscate', 'detect_obfuscation', 'extract_strings'],
                techniques: ['javascript', 'powershell', 'vbscript', 'base64']
            },
            'crypto': {
                description: 'Cryptographic analysis',
                operations: ['hash', 'detect_crypto', 'analyze_entropy'],
                algorithms: ['sha256', 'md5', 'aes', 'rsa']
            },
            'network': {
                description: 'Network traffic analysis',
                operations: ['analyze_pcap', 'extract_urls', 'detect_c2'],
                protocols: ['http', 'https', 'dns', 'tcp', 'udp']
            },
            'file-processor': {
                description: 'File format processing',
                operations: ['parse', 'extract_metadata', 'validate'],
                formats: ['pe', 'elf', 'pdf', 'office', 'zip']
            }
        };

        res.json({
            modules: Object.keys(wasmModules),
            capabilities,
            initialized: true
        });

    } catch (error) {
        logger.error('Failed to get WASM capabilities', { error });
        res.status(500).json({
            error: 'Failed to get WASM capabilities',
            message: error.message
        });
    }
});

/**
 * Module-specific analysis functions
 */

async function analyzeWithEngine(wasmModule, content, options) {
    const { analysisType = 'comprehensive' } = options;
    
    switch (analysisType) {
        case 'quick':
            return wasmModule.quick_scan(content);
        case 'deep':
            return wasmModule.deep_scan(content);
        default:
            return wasmModule.analyze(content);
    }
}

async function matchPatterns(wasmModule, content, options) {
    const { patterns = [], scanType = 'all' } = options;
    
    if (patterns.length > 0) {
        return wasmModule.match_patterns(content, patterns);
    }
    
    return wasmModule.scan(content, scanType);
}

async function deobfuscate(wasmModule, content, options) {
    const { technique = 'auto', extractStrings = true } = options;
    
    const result = {
        deobfuscated: wasmModule.deobfuscate(content, technique),
        obfuscationType: wasmModule.detect_obfuscation(content)
    };
    
    if (extractStrings) {
        result.strings = wasmModule.extract_strings(content);
    }
    
    return result;
}

async function analyzeCrypto(wasmModule, content, options) {
    const { operations = ['hash', 'entropy'] } = options;
    const result = {};
    
    if (operations.includes('hash')) {
        result.hashes = {
            sha256: wasmModule.sha256(content),
            md5: wasmModule.md5(content)
        };
    }
    
    if (operations.includes('entropy')) {
        result.entropy = wasmModule.calculate_entropy(content);
    }
    
    if (operations.includes('detect')) {
        result.cryptoUsage = wasmModule.detect_crypto(content);
    }
    
    return result;
}

async function analyzeNetwork(wasmModule, content, options) {
    const { extractUrls = true, detectC2 = true } = options;
    const result = {};
    
    // Analyze network patterns
    result.analysis = wasmModule.analyze(content);
    
    if (extractUrls) {
        result.urls = wasmModule.extract_urls(content);
    }
    
    if (detectC2) {
        result.c2Detection = wasmModule.detect_c2(content);
    }
    
    return result;
}

async function processFile(wasmModule, content, options) {
    const { extractMetadata = true, validate = true } = options;
    const result = {};
    
    // Parse file
    result.parsed = wasmModule.parse(content);
    
    if (extractMetadata) {
        result.metadata = wasmModule.extract_metadata(content);
    }
    
    if (validate) {
        result.validation = wasmModule.validate(content);
    }
    
    return result;
}

module.exports = router;