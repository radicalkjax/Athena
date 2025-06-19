"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoBridge = exports.CryptoBridge = exports.WASMError = void 0;
// Dynamic imports - will be loaded based on platform
let CryptoModule;
let HashModule;
let HmacModule;
let AesModule;
let RsaModule;
let CryptoUtils;
let RsaKeyPairWrapper;
let init_crypto_module;
const isBrowser = typeof window !== 'undefined';
class WASMError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WASMError';
    }
}
exports.WASMError = WASMError;
class CryptoBridge {
    constructor() {
        this.cryptoModule = null;
        this.hashModule = null;
        this.hmacModule = null;
        this.aesModule = null;
        this.rsaModule = null;
        this.utils = null;
        this.initialized = false;
    }
    static getInstance() {
        if (!CryptoBridge.instance) {
            CryptoBridge.instance = new CryptoBridge();
        }
        return CryptoBridge.instance;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Platform-specific loading
            if (isBrowser) {
                // Browser environment
                const module = await Promise.resolve().then(() => require('../core/crypto/pkg/web/crypto'));
                CryptoModule = module.CryptoModule;
                HashModule = module.HashModule;
                HmacModule = module.HmacModule;
                AesModule = module.AesModule;
                RsaModule = module.RsaModule;
                CryptoUtils = module.CryptoUtils;
                RsaKeyPairWrapper = module.RsaKeyPairWrapper;
                init_crypto_module = module.init_crypto_module || module.default;
            }
            else {
                // Node.js environment
                const module = require('../core/crypto/pkg/node/crypto');
                CryptoModule = module.CryptoModule;
                HashModule = module.HashModule;
                HmacModule = module.HmacModule;
                AesModule = module.AesModule;
                RsaModule = module.RsaModule;
                CryptoUtils = module.CryptoUtils;
                RsaKeyPairWrapper = module.RsaKeyPairWrapper;
                init_crypto_module = module.init_crypto_module || module.default;
            }
            if (init_crypto_module) {
                await init_crypto_module();
            }
            this.cryptoModule = new CryptoModule();
            this.hashModule = new HashModule();
            this.hmacModule = new HmacModule();
            this.aesModule = new AesModule();
            this.rsaModule = new RsaModule();
            this.utils = new CryptoUtils();
            this.initialized = true;
            console.log('WASM Crypto Module initialized successfully');
        }
        catch (error) {
            throw new WASMError(`Failed to initialize crypto module: ${error}`, 'INIT_ERROR');
        }
    }
    isInitialized() {
        return this.initialized && this.cryptoModule?.is_initialized() || false;
    }
    getCapabilities() {
        if (!this.cryptoModule) {
            throw new WASMError('Crypto module not initialized', 'NOT_INITIALIZED');
        }
        const capabilitiesJson = this.cryptoModule.get_capabilities();
        return JSON.parse(capabilitiesJson);
    }
    // Hash operations
    hash(data, options) {
        if (!this.hashModule) {
            throw new WASMError('Hash module not initialized', 'NOT_INITIALIZED');
        }
        const { algorithm, encoding = 'hex' } = options;
        switch (algorithm) {
            case 'sha256':
                return encoding === 'base64'
                    ? this.hashModule.sha256_base64(data)
                    : this.hashModule.sha256(data);
            case 'sha512':
                return this.hashModule.sha512(data);
            case 'sha384':
                return this.hashModule.sha384(data);
            case 'sha1':
                return this.hashModule.sha1(data);
            case 'md5':
                return this.hashModule.md5(data);
            default:
                throw new WASMError(`Unsupported hash algorithm: ${algorithm}`, 'INVALID_ALGORITHM');
        }
    }
    verifyHash(data, expectedHash, algorithm) {
        if (!this.hashModule) {
            throw new WASMError('Hash module not initialized', 'NOT_INITIALIZED');
        }
        return this.hashModule.verify_hash(algorithm, data, expectedHash);
    }
    async hashFileChunks(chunks, algorithm) {
        if (!this.hashModule) {
            throw new WASMError('Hash module not initialized', 'NOT_INITIALIZED');
        }
        // Convert chunks to base64 for JSON serialization
        const chunksBase64 = chunks.map(chunk => Array.from(chunk));
        const chunksJson = JSON.stringify(chunksBase64);
        return this.hashModule.hash_file_chunks(algorithm, chunksJson);
    }
    // HMAC operations
    hmac(key, data, options) {
        if (!this.hmacModule) {
            throw new WASMError('HMAC module not initialized', 'NOT_INITIALIZED');
        }
        const { algorithm, encoding = 'hex' } = options;
        switch (algorithm) {
            case 'hmac-sha256':
                return encoding === 'base64'
                    ? this.hmacModule.hmac_sha256_base64(key, data)
                    : this.hmacModule.hmac_sha256(key, data);
            case 'hmac-sha512':
                return this.hmacModule.hmac_sha512(key, data);
            case 'hmac-sha384':
                return this.hmacModule.hmac_sha384(key, data);
            default:
                throw new WASMError(`Unsupported HMAC algorithm: ${algorithm}`, 'INVALID_ALGORITHM');
        }
    }
    verifyHmac(key, data, expectedHmac, algorithm) {
        if (!this.hmacModule) {
            throw new WASMError('HMAC module not initialized', 'NOT_INITIALIZED');
        }
        return this.hmacModule.verify_hmac(algorithm, key, data, expectedHmac);
    }
    generateHmacKey(algorithm) {
        if (!this.hmacModule) {
            throw new WASMError('HMAC module not initialized', 'NOT_INITIALIZED');
        }
        return this.hmacModule.generate_hmac_key(algorithm);
    }
    // AES operations
    async encryptAES(key, plaintext, options) {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }
        const { algorithm } = options;
        switch (algorithm) {
            case 'aes-128-gcm':
                return this.aesModule.encrypt_aes_128_gcm(key, plaintext);
            case 'aes-256-gcm':
                return this.aesModule.encrypt_aes_256_gcm(key, plaintext);
            default:
                throw new WASMError(`Unsupported AES algorithm: ${algorithm}`, 'INVALID_ALGORITHM');
        }
    }
    async decryptAES(key, ciphertext, options) {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }
        const { algorithm } = options;
        switch (algorithm) {
            case 'aes-128-gcm':
                return this.aesModule.decrypt_aes_128_gcm(key, ciphertext);
            case 'aes-256-gcm':
                return this.aesModule.decrypt_aes_256_gcm(key, ciphertext);
            default:
                throw new WASMError(`Unsupported AES algorithm: ${algorithm}`, 'INVALID_ALGORITHM');
        }
    }
    generateAESKey(keySize) {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }
        return this.aesModule.generate_key(keySize);
    }
    deriveKeyFromPassword(password, salt, keySize = 256) {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }
        return this.aesModule.derive_key_from_password(password, salt, keySize);
    }
    // RSA operations
    async generateRSAKeyPair(options) {
        if (!this.rsaModule) {
            throw new WASMError('RSA module not initialized', 'NOT_INITIALIZED');
        }
        const keyPairWrapper = this.rsaModule.generate_key_pair(options.keySize);
        return {
            publicKey: keyPairWrapper.public_key,
            privateKey: keyPairWrapper.private_key,
            publicKeyBase64: keyPairWrapper.public_key_base64(),
            privateKeyBase64: keyPairWrapper.private_key_base64(),
        };
    }
    async signRSA(privateKey, message, hashAlgorithm) {
        if (!this.rsaModule) {
            throw new WASMError('RSA module not initialized', 'NOT_INITIALIZED');
        }
        switch (hashAlgorithm) {
            case 'sha256':
                return this.rsaModule.sign_sha256(privateKey, message);
            case 'sha512':
                return this.rsaModule.sign_sha512(privateKey, message);
            default:
                throw new WASMError(`Unsupported hash algorithm: ${hashAlgorithm}`, 'INVALID_ALGORITHM');
        }
    }
    async verifyRSA(publicKey, message, signature, hashAlgorithm) {
        if (!this.rsaModule) {
            throw new WASMError('RSA module not initialized', 'NOT_INITIALIZED');
        }
        switch (hashAlgorithm) {
            case 'sha256':
                return this.rsaModule.verify_sha256(publicKey, message, signature);
            case 'sha512':
                return this.rsaModule.verify_sha512(publicKey, message, signature);
            default:
                throw new WASMError(`Unsupported hash algorithm: ${hashAlgorithm}`, 'INVALID_ALGORITHM');
        }
    }
    // Utility operations
    generateRandomBytes(length) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.generate_random_bytes(length);
    }
    generateRandomHex(length) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.generate_random_hex(length);
    }
    generateRandomBase64(length) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.generate_random_base64(length);
    }
    constantTimeCompare(a, b) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.constant_time_compare(a, b);
    }
    calculateEntropy(data) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.calculate_entropy(data);
    }
    hexToBytes(hex) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.hex_to_bytes(hex);
    }
    bytesToHex(bytes) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.bytes_to_hex(bytes);
    }
    base64ToBytes(base64) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.base64_to_bytes(base64);
    }
    bytesToBase64(bytes) {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }
        return this.utils.bytes_to_base64(bytes);
    }
    // Cleanup
    cleanup() {
        this.cryptoModule?.free();
        this.hashModule?.free();
        this.hmacModule?.free();
        this.aesModule?.free();
        this.rsaModule?.free();
        this.utils?.free();
        this.cryptoModule = null;
        this.hashModule = null;
        this.hmacModule = null;
        this.aesModule = null;
        this.rsaModule = null;
        this.utils = null;
        this.initialized = false;
    }
}
exports.CryptoBridge = CryptoBridge;
CryptoBridge.instance = null;
// Export singleton instance
exports.cryptoBridge = CryptoBridge.getInstance();
