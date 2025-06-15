// Dynamic imports - will be loaded based on platform
let CryptoModule: any;
let HashModule: any;
let HmacModule: any;
let AesModule: any;
let RsaModule: any;
let CryptoUtils: any;
let RsaKeyPairWrapper: any;
let init_crypto_module: any;

declare const window: any;
const isBrowser = typeof window !== 'undefined';

// Type definitions
export interface CryptoCapabilities {
    hash: string[];
    hmac: string[];
    symmetric: string[];
    asymmetric: string[];
    kdf: string[];
    random: string[];
}

export interface HashOptions {
    algorithm: 'sha256' | 'sha512' | 'sha384' | 'sha1' | 'md5';
    encoding?: 'hex' | 'base64';
}

export interface HmacOptions {
    algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha384';
    encoding?: 'hex' | 'base64';
}

export interface AesOptions {
    algorithm: 'aes-128-gcm' | 'aes-256-gcm';
}

export interface RsaOptions {
    keySize: 2048 | 4096;
    hashAlgorithm: 'sha256' | 'sha512';
}

export interface RsaKeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    publicKeyBase64: string;
    privateKeyBase64: string;
}

export class WASMError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'WASMError';
    }
}

export class CryptoBridge {
    private static instance: CryptoBridge | null = null;
    private cryptoModule: any | null = null;
    private hashModule: any | null = null;
    private hmacModule: any | null = null;
    private aesModule: any | null = null;
    private rsaModule: any | null = null;
    private utils: any | null = null;
    private initialized = false;

    private constructor() {}

    static getInstance(): CryptoBridge {
        if (!CryptoBridge.instance) {
            CryptoBridge.instance = new CryptoBridge();
        }
        return CryptoBridge.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Platform-specific loading
            if (isBrowser) {
                // Browser environment
                const module = await import('../core/crypto/pkg/web/crypto');
                CryptoModule = module.CryptoModule;
                HashModule = module.HashModule;
                HmacModule = module.HmacModule;
                AesModule = module.AesModule;
                RsaModule = module.RsaModule;
                CryptoUtils = module.CryptoUtils;
                RsaKeyPairWrapper = module.RsaKeyPairWrapper;
                init_crypto_module = module.init_crypto_module || module.default;
            } else {
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
        } catch (error: unknown) {
            throw new WASMError(
                `Failed to initialize crypto module: ${error}`,
                'INIT_ERROR'
            );
        }
    }

    isInitialized(): boolean {
        return this.initialized && this.cryptoModule?.is_initialized() || false;
    }

    getCapabilities(): CryptoCapabilities {
        if (!this.cryptoModule) {
            throw new WASMError('Crypto module not initialized', 'NOT_INITIALIZED');
        }
        
        const capabilitiesJson = this.cryptoModule.get_capabilities();
        return JSON.parse(capabilitiesJson);
    }

    // Hash operations
    hash(data: Uint8Array, options: HashOptions): string {
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

    verifyHash(data: Uint8Array, expectedHash: string, algorithm: string): boolean {
        if (!this.hashModule) {
            throw new WASMError('Hash module not initialized', 'NOT_INITIALIZED');
        }

        return this.hashModule.verify_hash(algorithm, data, expectedHash);
    }

    async hashFileChunks(chunks: Uint8Array[], algorithm: string): Promise<string> {
        if (!this.hashModule) {
            throw new WASMError('Hash module not initialized', 'NOT_INITIALIZED');
        }

        // Convert chunks to base64 for JSON serialization
        const chunksBase64 = chunks.map(chunk => 
            Array.from(chunk)
        );
        
        const chunksJson = JSON.stringify(chunksBase64);
        return this.hashModule.hash_file_chunks(algorithm, chunksJson);
    }

    // HMAC operations
    hmac(key: Uint8Array, data: Uint8Array, options: HmacOptions): string {
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

    verifyHmac(key: Uint8Array, data: Uint8Array, expectedHmac: string, algorithm: string): boolean {
        if (!this.hmacModule) {
            throw new WASMError('HMAC module not initialized', 'NOT_INITIALIZED');
        }

        return this.hmacModule.verify_hmac(algorithm, key, data, expectedHmac);
    }

    generateHmacKey(algorithm: string): Uint8Array {
        if (!this.hmacModule) {
            throw new WASMError('HMAC module not initialized', 'NOT_INITIALIZED');
        }

        return this.hmacModule.generate_hmac_key(algorithm);
    }

    // AES operations
    async encryptAES(key: Uint8Array, plaintext: Uint8Array, options: AesOptions): Promise<string> {
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

    async decryptAES(key: Uint8Array, ciphertext: string, options: AesOptions): Promise<Uint8Array> {
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

    generateAESKey(keySize: 128 | 256): Uint8Array {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }

        return this.aesModule.generate_key(keySize);
    }

    deriveKeyFromPassword(password: string, salt?: Uint8Array, keySize: 128 | 256 = 256): Uint8Array {
        if (!this.aesModule) {
            throw new WASMError('AES module not initialized', 'NOT_INITIALIZED');
        }

        return this.aesModule.derive_key_from_password(password, salt, keySize);
    }

    // RSA operations
    async generateRSAKeyPair(options: RsaOptions): Promise<RsaKeyPair> {
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

    async signRSA(privateKey: Uint8Array, message: Uint8Array, hashAlgorithm: 'sha256' | 'sha512'): Promise<string> {
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

    async verifyRSA(publicKey: Uint8Array, message: Uint8Array, signature: string, hashAlgorithm: 'sha256' | 'sha512'): Promise<boolean> {
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
    generateRandomBytes(length: number): Uint8Array {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.generate_random_bytes(length);
    }

    generateRandomHex(length: number): string {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.generate_random_hex(length);
    }

    generateRandomBase64(length: number): string {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.generate_random_base64(length);
    }

    constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.constant_time_compare(a, b);
    }

    calculateEntropy(data: Uint8Array): number {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.calculate_entropy(data);
    }

    hexToBytes(hex: string): Uint8Array {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.hex_to_bytes(hex);
    }

    bytesToHex(bytes: Uint8Array): string {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.bytes_to_hex(bytes);
    }

    base64ToBytes(base64: string): Uint8Array {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.base64_to_bytes(base64);
    }

    bytesToBase64(bytes: Uint8Array): string {
        if (!this.utils) {
            throw new WASMError('Utils module not initialized', 'NOT_INITIALIZED');
        }

        return this.utils.bytes_to_base64(bytes);
    }

    // Cleanup
    cleanup(): void {
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

// Export singleton instance
export const cryptoBridge = CryptoBridge.getInstance();