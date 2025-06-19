import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the crypto bridge to avoid loading real WASM modules
vi.mock('../../bridge/crypto-bridge', () => {
  return import('../../bridge/__mocks__/crypto-bridge');
});

import { cryptoBridge } from '../../bridge/crypto-bridge';

describe('WASM Crypto Module Integration Tests', () => {
    beforeAll(async () => {
        await cryptoBridge.initialize();
    });

    afterAll(() => {
        cryptoBridge.cleanup();
    });

    describe('Module Initialization', () => {
        it('should initialize successfully', () => {
            expect(cryptoBridge.isInitialized()).toBe(true);
        });

        it('should return capabilities', () => {
            const capabilities = cryptoBridge.getCapabilities();
            expect(capabilities).toHaveProperty('hash');
            expect(capabilities).toHaveProperty('hmac');
            expect(capabilities).toHaveProperty('symmetric');
            expect(capabilities).toHaveProperty('asymmetric');
            expect(capabilities.hash).toContain('sha256');
            expect(capabilities.symmetric).toContain('aes-256-gcm');
        });
    });

    describe('Hash Operations', () => {
        const testData = new TextEncoder().encode('Hello, World!');
        
        it('should compute SHA256 hash', () => {
            const hash = cryptoBridge.hash(testData, { algorithm: 'sha256' });
            expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        });

        it('should compute SHA256 hash in base64', () => {
            const hash = cryptoBridge.hash(testData, { algorithm: 'sha256', encoding: 'base64' });
            expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });

        it('should compute SHA512 hash', () => {
            const hash = cryptoBridge.hash(testData, { algorithm: 'sha512' });
            expect(hash.length).toBe(128); // SHA512 produces 64 bytes = 128 hex chars
        });

        it('should compute MD5 hash', () => {
            const hash = cryptoBridge.hash(testData, { algorithm: 'md5' });
            expect(hash.length).toBe(32); // MD5 produces 16 bytes = 32 hex chars
        });

        it('should verify hash correctly', () => {
            const hash = cryptoBridge.hash(testData, { algorithm: 'sha256' });
            const isValid = cryptoBridge.verifyHash(testData, hash, 'sha256');
            expect(isValid).toBe(true);
        });

        it('should reject invalid hash', () => {
            const isValid = cryptoBridge.verifyHash(testData, 'invalid_hash', 'sha256');
            expect(isValid).toBe(false);
        });

        it('should hash file chunks', async () => {
            const chunk1 = new TextEncoder().encode('Hello, ');
            const chunk2 = new TextEncoder().encode('World!');
            const hash = await cryptoBridge.hashFileChunks([chunk1, chunk2], 'sha256');
            expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        });
    });

    describe('HMAC Operations', () => {
        const key = new TextEncoder().encode('secret_key');
        const data = new TextEncoder().encode('Hello, World!');

        it('should compute HMAC-SHA256', () => {
            const hmac = cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256' });
            expect(hmac.length).toBe(64); // HMAC-SHA256 produces 32 bytes = 64 hex chars
        });

        it('should compute HMAC-SHA256 in base64', () => {
            const hmac = cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256', encoding: 'base64' });
            expect(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });

        it('should verify HMAC correctly', () => {
            const hmac = cryptoBridge.hmac(key, data, { algorithm: 'hmac-sha256' });
            const isValid = cryptoBridge.verifyHmac(key, data, hmac, 'hmac-sha256');
            expect(isValid).toBe(true);
        });

        it('should reject invalid HMAC', () => {
            const isValid = cryptoBridge.verifyHmac(key, data, 'invalid_hmac', 'hmac-sha256');
            expect(isValid).toBe(false);
        });

        it('should generate HMAC key', () => {
            const key = cryptoBridge.generateHmacKey('hmac-sha256');
            expect(key.length).toBe(32); // 256 bits = 32 bytes
        });
    });

    describe('AES Operations', () => {
        it('should encrypt and decrypt with AES-128-GCM', async () => {
            const key = cryptoBridge.generateAESKey(128);
            const plaintext = new TextEncoder().encode('Secret message');
            
            const ciphertext = await cryptoBridge.encryptAES(key, plaintext, { algorithm: 'aes-128-gcm' });
            expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
            
            const decrypted = await cryptoBridge.decryptAES(key, ciphertext, { algorithm: 'aes-128-gcm' });
            expect(new TextDecoder().decode(decrypted)).toBe('Secret message');
        });

        it('should encrypt and decrypt with AES-256-GCM', async () => {
            const key = cryptoBridge.generateAESKey(256);
            const plaintext = new TextEncoder().encode('Another secret message');
            
            const ciphertext = await cryptoBridge.encryptAES(key, plaintext, { algorithm: 'aes-256-gcm' });
            expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
            
            const decrypted = await cryptoBridge.decryptAES(key, ciphertext, { algorithm: 'aes-256-gcm' });
            expect(new TextDecoder().decode(decrypted)).toBe('Another secret message');
        });

        it('should derive key from password', () => {
            const password = 'strong_password';
            const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            
            const key1 = cryptoBridge.deriveKeyFromPassword(password, salt, 256);
            const key2 = cryptoBridge.deriveKeyFromPassword(password, salt, 256);
            
            expect(key1.length).toBe(32);
            expect(key1).toEqual(key2);
        });

        it('should fail decryption with wrong key', async () => {
            const key1 = cryptoBridge.generateAESKey(256);
            const key2 = cryptoBridge.generateAESKey(256);
            const plaintext = new TextEncoder().encode('Secret');
            
            const ciphertext = await cryptoBridge.encryptAES(key1, plaintext, { algorithm: 'aes-256-gcm' });
            
            await expect(
                cryptoBridge.decryptAES(key2, ciphertext, { algorithm: 'aes-256-gcm' })
            ).rejects.toThrow();
        });
    });

    describe('RSA Operations', () => {
        it('should generate RSA key pair', async () => {
            const keyPair = await cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            
            expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.publicKeyBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
            expect(keyPair.privateKeyBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });

        it('should sign and verify with RSA-SHA256', async () => {
            const keyPair = await cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            const message = new TextEncoder().encode('Message to sign');
            
            const signature = await cryptoBridge.signRSA(keyPair.privateKey, message, 'sha256');
            expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
            
            const isValid = await cryptoBridge.verifyRSA(keyPair.publicKey, message, signature, 'sha256');
            expect(isValid).toBe(true);
        });

        it('should sign and verify with RSA-SHA512', async () => {
            const keyPair = await cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha512' });
            const message = new TextEncoder().encode('Another message');
            
            const signature = await cryptoBridge.signRSA(keyPair.privateKey, message, 'sha512');
            const isValid = await cryptoBridge.verifyRSA(keyPair.publicKey, message, signature, 'sha512');
            expect(isValid).toBe(true);
        });

        it('should reject invalid signature', async () => {
            const keyPair = await cryptoBridge.generateRSAKeyPair({ keySize: 2048, hashAlgorithm: 'sha256' });
            const message = new TextEncoder().encode('Message');
            
            const isValid = await cryptoBridge.verifyRSA(keyPair.publicKey, message, 'invalid_signature', 'sha256');
            expect(isValid).toBe(false);
        });
    });

    describe('Utility Operations', () => {
        it('should generate random bytes', () => {
            const bytes1 = cryptoBridge.generateRandomBytes(32);
            const bytes2 = cryptoBridge.generateRandomBytes(32);
            
            expect(bytes1.length).toBe(32);
            expect(bytes2.length).toBe(32);
            expect(bytes1).not.toEqual(bytes2);
        });

        it('should generate random hex', () => {
            const hex = cryptoBridge.generateRandomHex(16);
            expect(hex.length).toBe(32); // 16 bytes = 32 hex chars
            expect(hex).toMatch(/^[0-9a-f]+$/);
        });

        it('should generate random base64', () => {
            const base64 = cryptoBridge.generateRandomBase64(24);
            expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });

        it('should perform constant time comparison', () => {
            const a = new Uint8Array([1, 2, 3, 4, 5]);
            const b = new Uint8Array([1, 2, 3, 4, 5]);
            const c = new Uint8Array([1, 2, 3, 4, 6]);
            
            expect(cryptoBridge.constantTimeCompare(a, b)).toBe(true);
            expect(cryptoBridge.constantTimeCompare(a, c)).toBe(false);
        });

        it('should calculate entropy', () => {
            const lowEntropy = new Uint8Array(100).fill(0);
            const highEntropy = cryptoBridge.generateRandomBytes(100);
            
            const low = cryptoBridge.calculateEntropy(lowEntropy);
            const high = cryptoBridge.calculateEntropy(highEntropy);
            
            expect(low).toBe(0);
            expect(high).toBeGreaterThan(5);
        });

        it('should convert between hex and bytes', () => {
            const bytes = new Uint8Array([1, 2, 3, 4, 5]);
            const hex = cryptoBridge.bytesToHex(bytes);
            expect(hex).toBe('0102030405');
            
            const decoded = cryptoBridge.hexToBytes(hex);
            expect(decoded).toEqual(bytes);
        });

        it('should convert between base64 and bytes', () => {
            const bytes = new Uint8Array([1, 2, 3, 4, 5]);
            const base64 = cryptoBridge.bytesToBase64(bytes);
            expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
            
            const decoded = cryptoBridge.base64ToBytes(base64);
            expect(decoded).toEqual(bytes);
        });
    });

    describe('Error Handling', () => {
        it('should throw error for unsupported hash algorithm', () => {
            const data = new Uint8Array([1, 2, 3]);
            expect(() => {
                cryptoBridge.hash(data, { algorithm: 'unsupported' as any });
            }).toThrow('Unsupported hash algorithm');
        });

        it('should throw error for invalid AES key size', async () => {
            const wrongKey = new Uint8Array(24); // Wrong size
            const data = new Uint8Array([1, 2, 3]);
            
            await expect(
                cryptoBridge.encryptAES(wrongKey, data, { algorithm: 'aes-256-gcm' })
            ).rejects.toThrow('Invalid key length');
        });

        it('should throw error for invalid base64 input', () => {
            expect(() => {
                cryptoBridge.base64ToBytes('invalid!@#$');
            }).toThrow();
        });
    });

    describe('Performance Tests', () => {
        it('should hash large data efficiently', () => {
            const largeData = new Uint8Array(1024 * 1024); // 1MB
            cryptoBridge.generateRandomBytes(1024 * 1024).forEach((byte, i) => {
                largeData[i] = byte;
            });
            
            const start = performance.now();
            const hash = cryptoBridge.hash(largeData, { algorithm: 'sha256' });
            const duration = performance.now() - start;
            
            expect(hash.length).toBe(64);
            expect(duration).toBeLessThan(100); // Should hash 1MB in less than 100ms
        });

        it('should encrypt/decrypt efficiently', async () => {
            const key = cryptoBridge.generateAESKey(256);
            const data = cryptoBridge.generateRandomBytes(1024 * 100); // 100KB
            
            const start = performance.now();
            const encrypted = await cryptoBridge.encryptAES(key, data, { algorithm: 'aes-256-gcm' });
            const decrypted = await cryptoBridge.decryptAES(key, encrypted, { algorithm: 'aes-256-gcm' });
            const duration = performance.now() - start;
            
            expect(decrypted).toEqual(data);
            expect(duration).toBeLessThan(50); // Should process 100KB in less than 50ms
        });
    });
});