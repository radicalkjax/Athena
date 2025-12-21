#!/bin/sh

echo "Starting Athena API Server..."

# If WASM is disabled, mock the module before starting
if [ "$DISABLE_WASM" = "true" ]; then
    echo "WASM disabled - creating mock modules..."
    
    # Create wasm-modules directory structure
    mkdir -p /app/wasm-modules/bridge
    
    # Create a mock bridge module
    cat > /app/wasm-modules/bridge/index.js << 'EOF'
// Mock WASM bridge module
console.log('Using mock WASM bridge - WASM disabled');

module.exports = {
    CryptoBridge: class {
        async initialize() { console.log('Mock CryptoBridge initialized'); }
        async hashData(data) { return 'mock-hash-' + data.slice(0, 10); }
    },
    AnalysisEngineBridge: class {
        async initialize() { console.log('Mock AnalysisEngineBridge initialized'); }
        async analyzeFile(data) { return { safe: true, mockAnalysis: true }; }
    },
    FileProcessorBridge: class {
        async initialize() { console.log('Mock FileProcessorBridge initialized'); }
        async processFile(data) { return { processed: true, mockData: true }; }
    },
    PatternMatcherBridge: class {
        async initialize() { console.log('Mock PatternMatcherBridge initialized'); }
        async matchPatterns(data) { return { matches: [], mockMatcher: true }; }
    },
    SandboxBridge: class {
        async initialize() { console.log('Mock SandboxBridge initialized'); }
        async execute(code) { return { output: 'mock output', mockSandbox: true }; }
    },
    NetworkBridge: class {
        async initialize() { console.log('Mock NetworkBridge initialized'); }
        async analyzePacket(data) { return { protocol: 'mock', mockNetwork: true }; }
    },
    DeobfuscatorBridge: class {
        async initialize() { console.log('Mock DeobfuscatorBridge initialized'); }
        async deobfuscate(code) { return code; }
    }
};
EOF
fi

# Start the server
exec node services/server.js