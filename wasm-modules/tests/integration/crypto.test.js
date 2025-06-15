"use strict";
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
const globals_1 = require("@jest/globals");
const crypto_bridge_1 = require("../../bridge/crypto-bridge");
(0, globals_1.describe)('WASM Crypto Module Integration Tests', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield crypto_bridge_1.cryptoBridge.initialize();
    }));
    (0, globals_1.afterAll)(() => {
        crypto_bridge_1.cryptoBridge.cleanup();
    });
    (0, globals_1.describe)('Module Initialization', () => {
        (0, globals_1.it)('should initialize successfully', () => {
            (0, globals_1.expect)(crypto_bridge_1.cryptoBridge.isInitialized()).toBe(true);
        });
        (0, globals_1.it)('should return capabilities', () => {
            const capabilities = crypto_bridge_1.cryptoBridge.getCapabilities();
            (0, globals_1.expect)(capabilities).toHaveProperty('hash');
            (0, globals_1.expect)(capabilities).toHaveProperty('hmac');
            (0, globals_1.expect)(capabilities).toHaveProperty('symmetric');
            (0, globals_1.expect)(capabilities).toHaveProperty('asymmetric');
            (0, globals_1.expect)(capabilities.hash).toContain('sha256');
            (0, globals_1.expect)(capabilities.symmetric).toContain('aes-256-gcm');
        });
    });
    (0, globals_1.describe)('Hash Operations', () => {
        const testData = new TextEncoder().encode('Hello, World!');
        (0, globals_1.it)('should compute SHA256 hash', () => {
            const hash = crypto_bridge_1.cryptoBridge.hash(testData, { algorithm: 'sha256' });
            (0, globals_1.expect)(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        });
        (0, globals_1.it)('should compute SHA256 hash in base64', () => {
            const hash = crypto_bridge_1.cryptoBridge.hash(testData, { algorithm: 'sha256', encoding: 'base64' });
            (0, globals_1.expect)(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });
        (0, globals_1.it)('should compute SHA512 hash', () => {
            const hash = crypto_bridge_1.cryptoBridge.hash(testData, { algorithm: 'sha512' });
            (0, globals_1.expect)(hash.length).toBe(128); // SHA512 produces 64 bytes = 128 hex chars
        });
        (0, globals_1.it)('should compute MD5 hash', () => {
            const hash = crypto_bridge_1.cryptoBridge.hash(testData, { algorithm: 'md5' });
            (0, globals_1.expect)(hash.length).toBe(32); // MD5 produces 16 bytes = 32 hex chars
        });
        (0, globals_1.it)('should verify hash correctly', () => {
            const hash = crypto_bridge_1.cryptoBridge.hash(testData, { algorithm: 'sha256' });
            const isValid = crypto_bridge_1.cryptoBridge.verifyHash(testData, hash, 'sha256');
            (0, globals_1.expect)(isValid).toBe(true);
        });
        (0, globals_1.it)('should reject invalid hash', () => {
            const isValid = crypto_bridge_1.cryptoBridge.verifyHash(testData, 'invalid_hash', 'sha256');
            (0, globals_1.expect)(isValid).toBe(false);
        });
        (0, globals_1.it)('should hash file chunks', () => __awaiter(void 0, void 0, void 0, function* () {
            const chunk1 = new TextEncoder().encode('Hello, ');
            const chunk2 = new TextEncoder().encode('World!');
            const hash = yield crypto_bridge_1.cryptoBridge.hashFileChunks([chunk1, chunk2], 'sha256');
            (0, globals_1.expect)(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        }));
    });
    (0, globals_1.describe)('HMAC Operations', () => {
        const key = new TextEncoder().encode('secret_key');
        const data = new TextEncoder().encode('Hello, World!');
        (0, globals_1.it)('should compute HMAC-SHA256', () => {
            const hmac = crypto_bridge_1.cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256' });
            (0, globals_1.expect)(hmac.length).toBe(64); // HMAC-SHA256 produces 32 bytes = 64 hex chars
        });
        (0, globals_1.it)('should compute HMAC-SHA256 in base64', () => {
            const hmac = crypto_bridge_1.cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256', encoding: 'base64' });
            (0, globals_1.expect)(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });
        (0, globals_1.it)('should verify HMAC correctly', () => {
            const hmac = crypto_bridge_1.cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256' });
            const isValid = crypto_bridge_1.cryptoBridge.verifyHmac(key, data, hmac, 'hmac-sha256');
            (0, globals_1.expect)(isValid).toBe(true);
        });
        (0, globals_1.it)('should reject invalid HMAC', () => {
            const isValid = crypto_bridge_1.cryptoBridge.verifyHmac(key, data, 'invalid_hmac', 'hmac-sha256');
            (0, globals_1.expect)(isValid).toBe(false);
        });
        (0, globals_1.it)('should generate HMAC key', () => {
            const key = crypto_bridge_1.cryptoBridge.generateHmacKey('hmac-sha256');
            (0, globals_1.expect)(key.length).toBe(32); // 256 bits = 32 bytes
        });
    });
    (0, globals_1.describe)('AES Operations', () => {
        (0, globals_1.it)('should encrypt and decrypt with AES-128-GCM', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = crypto_bridge_1.cryptoBridge.generateAESKey(128);
            const plaintext = new TextEncoder().encode('Secret message');
            const ciphertext = yield crypto_bridge_1.cryptoBridge.encryptAES(key, plaintext, { algorithm: 'aes-128-gcm' });
            (0, globals_1.expect)(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
            const decrypted = yield crypto_bridge_1.cryptoBridge.decryptAES(key, ciphertext, { algorithm: 'aes-128-gcm' });
            (0, globals_1.expect)(new TextDecoder().decode(decrypted)).toBe('Secret message');
        }));
        (0, globals_1.it)('should encrypt and decrypt with AES-256-GCM', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = crypto_bridge_1.cryptoBridge.generateAESKey(256);
            const plaintext = new TextEncoder().encode('Another secret message');
            const ciphertext = yield crypto_bridge_1.cryptoBridge.encryptAES(key, plaintext, { algorithm: 'aes-256-gcm' });
            (0, globals_1.expect)(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
            const decrypted = yield crypto_bridge_1.cryptoBridge.decryptAES(key, ciphertext, { algorithm: 'aes-256-gcm' });
            (0, globals_1.expect)(new TextDecoder().decode(decrypted)).toBe('Another secret message');
        }));
        (0, globals_1.it)('should derive key from password', () => {
            const password = 'strong_password';
            const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            const key1 = crypto_bridge_1.cryptoBridge.deriveKeyFromPassword(password, salt, 256);
            const key2 = crypto_bridge_1.cryptoBridge.deriveKeyFromPassword(password, salt, 256);
            (0, globals_1.expect)(key1.length).toBe(32);
            (0, globals_1.expect)(key1).toEqual(key2);
        });
        (0, globals_1.it)('should fail decryption with wrong key', () => __awaiter(void 0, void 0, void 0, function* () {
            const key1 = crypto_bridge_1.cryptoBridge.generateAESKey(256);
            const key2 = crypto_bridge_1.cryptoBridge.generateAESKey(256);
            const plaintext = new TextEncoder().encode('Secret');
            const ciphertext = yield crypto_bridge_1.cryptoBridge.encryptAES(key1, plaintext, { algorithm: 'aes-256-gcm' });
            yield (0, globals_1.expect)(crypto_bridge_1.cryptoBridge.decryptAES(key2, ciphertext, { algorithm: 'aes-256-gcm' })).rejects.toThrow();
        }));
    });
    (0, globals_1.describe)('RSA Operations', () => {
        (0, globals_1.it)('should generate RSA key pair', () => __awaiter(void 0, void 0, void 0, function* () {
            const keyPair = yield crypto_bridge_1.cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            (0, globals_1.expect)(keyPair.publicKey).toBeInstanceOf(Uint8Array);
            (0, globals_1.expect)(keyPair.privateKey).toBeInstanceOf(Uint8Array);
            (0, globals_1.expect)(keyPair.publicKeyBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
            (0, globals_1.expect)(keyPair.privateKeyBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
        }));
        (0, globals_1.it)('should sign and verify with RSA-SHA256', () => __awaiter(void 0, void 0, void 0, function* () {
            const keyPair = yield crypto_bridge_1.cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            const message = new TextEncoder().encode('Message to sign');
            const signature = yield crypto_bridge_1.cryptoBridge.signRSA(keyPair.privateKey, message, 'sha256');
            (0, globals_1.expect)(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
            const isValid = yield crypto_bridge_1.cryptoBridge.verifyRSA(keyPair.publicKey, message, signature, 'sha256');
            (0, globals_1.expect)(isValid).toBe(true);
        }));
        (0, globals_1.it)('should sign and verify with RSA-SHA512', () => __awaiter(void 0, void 0, void 0, function* () {
            const keyPair = yield crypto_bridge_1.cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha512' });
            const message = new TextEncoder().encode('Another message');
            const signature = yield crypto_bridge_1.cryptoBridge.signRSA(keyPair.privateKey, message, 'sha512');
            const isValid = yield crypto_bridge_1.cryptoBridge.verifyRSA(keyPair.publicKey, message, signature, 'sha512');
            (0, globals_1.expect)(isValid).toBe(true);
        }));
        (0, globals_1.it)('should reject invalid signature', () => __awaiter(void 0, void 0, void 0, function* () {
            const keyPair = yield crypto_bridge_1.cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            const message = new TextEncoder().encode('Message');
            const isValid = yield crypto_bridge_1.cryptoBridge.verifyRSA(keyPair.publicKey, message, 'invalid_signature', 'sha256');
            (0, globals_1.expect)(isValid).toBe(false);
        }));
    });
    (0, globals_1.describe)('Utility Operations', () => {
        (0, globals_1.it)('should generate random bytes', () => {
            const bytes1 = crypto_bridge_1.cryptoBridge.generateRandomBytes(32);
            const bytes2 = crypto_bridge_1.cryptoBridge.generateRandomBytes(32);
            (0, globals_1.expect)(bytes1.length).toBe(32);
            (0, globals_1.expect)(bytes2.length).toBe(32);
            (0, globals_1.expect)(bytes1).not.toEqual(bytes2);
        });
        (0, globals_1.it)('should generate random hex', () => {
            const hex = crypto_bridge_1.cryptoBridge.generateRandomHex(16);
            (0, globals_1.expect)(hex.length).toBe(32); // 16 bytes = 32 hex chars
            (0, globals_1.expect)(hex).toMatch(/^[0-9a-f]+$/);
        });
        (0, globals_1.it)('should generate random base64', () => {
            const base64 = crypto_bridge_1.cryptoBridge.generateRandomBase64(24);
            (0, globals_1.expect)(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });
        (0, globals_1.it)('should perform constant time comparison', () => {
            const a = new Uint8Array([1, 2, 3, 4, 5]);
            const b = new Uint8Array([1, 2, 3, 4, 5]);
            const c = new Uint8Array([1, 2, 3, 4, 6]);
            (0, globals_1.expect)(crypto_bridge_1.cryptoBridge.constantTimeCompare(a, b)).toBe(true);
            (0, globals_1.expect)(crypto_bridge_1.cryptoBridge.constantTimeCompare(a, c)).toBe(false);
        });
        (0, globals_1.it)('should calculate entropy', () => {
            const lowEntropy = new Uint8Array(100).fill(0);
            const highEntropy = crypto_bridge_1.cryptoBridge.generateRandomBytes(100);
            const low = crypto_bridge_1.cryptoBridge.calculateEntropy(lowEntropy);
            const high = crypto_bridge_1.cryptoBridge.calculateEntropy(highEntropy);
            (0, globals_1.expect)(low).toBe(0);
            (0, globals_1.expect)(high).toBeGreaterThan(5);
        });
        (0, globals_1.it)('should convert between hex and bytes', () => {
            const bytes = new Uint8Array([1, 2, 3, 4, 5]);
            const hex = crypto_bridge_1.cryptoBridge.bytesToHex(bytes);
            (0, globals_1.expect)(hex).toBe('0102030405');
            const decoded = crypto_bridge_1.cryptoBridge.hexToBytes(hex);
            (0, globals_1.expect)(decoded).toEqual(bytes);
        });
        (0, globals_1.it)('should convert between base64 and bytes', () => {
            const bytes = new Uint8Array([1, 2, 3, 4, 5]);
            const base64 = crypto_bridge_1.cryptoBridge.bytesToBase64(bytes);
            (0, globals_1.expect)(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
            const decoded = crypto_bridge_1.cryptoBridge.base64ToBytes(base64);
            (0, globals_1.expect)(decoded).toEqual(bytes);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should throw error for unsupported hash algorithm', () => {
            const data = new Uint8Array([1, 2, 3]);
            (0, globals_1.expect)(() => {
                crypto_bridge_1.cryptoBridge.hash(data, { algorithm: 'unsupported' });
            }).toThrow('Unsupported hash algorithm');
        });
        (0, globals_1.it)('should throw error for invalid AES key size', () => __awaiter(void 0, void 0, void 0, function* () {
            const wrongKey = new Uint8Array(24); // Wrong size
            const data = new Uint8Array([1, 2, 3]);
            yield (0, globals_1.expect)(crypto_bridge_1.cryptoBridge.encryptAES(wrongKey, data, { algorithm: 'aes-256-gcm' })).rejects.toThrow('Invalid key length');
        }));
        (0, globals_1.it)('should throw error for invalid base64 input', () => {
            (0, globals_1.expect)(() => {
                crypto_bridge_1.cryptoBridge.base64ToBytes('invalid!@#$');
            }).toThrow();
        });
    });
    (0, globals_1.describe)('Performance Tests', () => {
        (0, globals_1.it)('should hash large data efficiently', () => {
            const largeData = new Uint8Array(1024 * 1024); // 1MB
            crypto_bridge_1.cryptoBridge.generateRandomBytes(1024 * 1024).forEach((byte, i) => {
                largeData[i] = byte;
            });
            const start = performance.now();
            const hash = crypto_bridge_1.cryptoBridge.hash(largeData, { algorithm: 'sha256' });
            const duration = performance.now() - start;
            (0, globals_1.expect)(hash.length).toBe(64);
            (0, globals_1.expect)(duration).toBeLessThan(100); // Should hash 1MB in less than 100ms
        });
        (0, globals_1.it)('should encrypt/decrypt efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = crypto_bridge_1.cryptoBridge.generateAESKey(256);
            const data = crypto_bridge_1.cryptoBridge.generateRandomBytes(1024 * 100); // 100KB
            const start = performance.now();
            const encrypted = yield crypto_bridge_1.cryptoBridge.encryptAES(key, data, { algorithm: 'aes-256-gcm' });
            const decrypted = yield crypto_bridge_1.cryptoBridge.decryptAES(key, encrypted, { algorithm: 'aes-256-gcm' });
            const duration = performance.now() - start;
            (0, globals_1.expect)(decrypted).toEqual(data);
            (0, globals_1.expect)(duration).toBeLessThan(50); // Should process 100KB in less than 50ms
        }));
    });
});
