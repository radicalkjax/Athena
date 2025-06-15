import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { logger } from '../logging/logger';
import { env, APIProvider } from '../config/environment';

interface StorageOptions {
  keychainService?: string;
  keychainAccessible?: SecureStore.SecureStoreAccessible;
}

class SecureStorage {
  private readonly keyPrefix = 'athena_secure_';
  private readonly webStorageKey = 'athena_encrypted_storage';
  private memoryCache: Map<string, string> = new Map();

  // Platform-specific storage options
  private getStorageOptions(): StorageOptions {
    if (Platform.OS === 'ios') {
      return {
        keychainService: 'com.athena.secure',
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      };
    }
    return {};
  }

  // Generate a consistent encryption key for web
  private async getWebEncryptionKey(): Promise<string> {
    // In a real app, this should be derived from user authentication
    // For now, we'll use a device-specific key
    const deviceId = await this.getDeviceId();
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `athena_web_key_${deviceId}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
  }

  // Get or generate a device ID
  private async getDeviceId(): Promise<string> {
    const key = 'device_id';
    let deviceId = localStorage.getItem(key);
    
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      localStorage.setItem(key, deviceId);
    }
    
    return deviceId;
  }

  // Encrypt data for web storage
  private async encryptForWeb(data: string): Promise<string> {
    try {
      // Simple XOR encryption for demo - in production use proper encryption
      const key = await this.getWebEncryptionKey();
      const encrypted = btoa(
        data.split('').map((char, i) => 
          String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
        ).join('')
      );
      return encrypted;
    } catch (error: unknown) {
      logger.error('Web encryption failed', error);
      throw error;
    }
  }

  // Decrypt data from web storage
  private async decryptFromWeb(encrypted: string): Promise<string> {
    try {
      const key = await this.getWebEncryptionKey();
      const data = atob(encrypted);
      const decrypted = data.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      ).join('');
      return decrypted;
    } catch (error: unknown) {
      logger.error('Web decryption failed', error);
      throw error;
    }
  }

  // Store API key securely
  async setApiKey(provider: APIProvider, key: string): Promise<void> {
    const storageKey = `${this.keyPrefix}api_${provider}`;
    
    try {
      if (Platform.OS === 'web') {
        // For web, encrypt and store in localStorage
        const encrypted = await this.encryptForWeb(key);
        const storage = this.getWebStorage();
        storage[storageKey] = encrypted;
        localStorage.setItem(this.webStorageKey, JSON.stringify(storage));
      } else {
        // For native, use SecureStore
        await SecureStore.setItemAsync(storageKey, key, this.getStorageOptions());
      }
      
      // Update memory cache
      this.memoryCache.set(storageKey, key);
      
      logger.info(`API key stored securely for ${provider}`);
    } catch (error: unknown) {
      logger.error(`Failed to store API key for ${provider}`, error);
      throw new Error(`Failed to store API key: ${error}`);
    }
  }

  // Retrieve API key
  async getApiKey(provider: APIProvider): Promise<string | null> {
    const storageKey = `${this.keyPrefix}api_${provider}`;
    
    // Check memory cache first
    if (this.memoryCache.has(storageKey)) {
      return this.memoryCache.get(storageKey) || null;
    }
    
    try {
      let value: string | null = null;
      
      if (Platform.OS === 'web') {
        // For web, decrypt from localStorage
        const storage = this.getWebStorage();
        const encrypted = storage[storageKey];
        if (encrypted) {
          value = await this.decryptFromWeb(encrypted);
        }
      } else {
        // For native, use SecureStore
        value = await SecureStore.getItemAsync(storageKey, this.getStorageOptions());
      }
      
      // Update memory cache
      if (value) {
        this.memoryCache.set(storageKey, value);
      }
      
      return value;
    } catch (error: unknown) {
      logger.error(`Failed to retrieve API key for ${provider}`, error);
      return null;
    }
  }

  // Remove API key
  async removeApiKey(provider: APIProvider): Promise<void> {
    const storageKey = `${this.keyPrefix}api_${provider}`;
    
    try {
      if (Platform.OS === 'web') {
        // For web, remove from localStorage
        const storage = this.getWebStorage();
        delete storage[storageKey];
        localStorage.setItem(this.webStorageKey, JSON.stringify(storage));
      } else {
        // For native, use SecureStore
        await SecureStore.deleteItemAsync(storageKey, this.getStorageOptions());
      }
      
      // Remove from memory cache
      this.memoryCache.delete(storageKey);
      
      logger.info(`API key removed for ${provider}`);
    } catch (error: unknown) {
      logger.error(`Failed to remove API key for ${provider}`, error);
      throw new Error(`Failed to remove API key: ${error}`);
    }
  }

  // Store generic secure data
  async setSecureItem(key: string, value: string): Promise<void> {
    const storageKey = `${this.keyPrefix}${key}`;
    
    try {
      if (Platform.OS === 'web') {
        const encrypted = await this.encryptForWeb(value);
        const storage = this.getWebStorage();
        storage[storageKey] = encrypted;
        localStorage.setItem(this.webStorageKey, JSON.stringify(storage));
      } else {
        await SecureStore.setItemAsync(storageKey, value, this.getStorageOptions());
      }
      
      this.memoryCache.set(storageKey, value);
      logger.debug(`Secure item stored: ${key}`);
    } catch (error: unknown) {
      logger.error(`Failed to store secure item: ${key}`, error);
      throw error;
    }
  }

  // Retrieve generic secure data
  async getSecureItem(key: string): Promise<string | null> {
    const storageKey = `${this.keyPrefix}${key}`;
    
    if (this.memoryCache.has(storageKey)) {
      return this.memoryCache.get(storageKey) || null;
    }
    
    try {
      let value: string | null = null;
      
      if (Platform.OS === 'web') {
        const storage = this.getWebStorage();
        const encrypted = storage[storageKey];
        if (encrypted) {
          value = await this.decryptFromWeb(encrypted);
        }
      } else {
        value = await SecureStore.getItemAsync(storageKey, this.getStorageOptions());
      }
      
      if (value) {
        this.memoryCache.set(storageKey, value);
      }
      
      return value;
    } catch (error: unknown) {
      logger.error(`Failed to retrieve secure item: ${key}`, error);
      return null;
    }
  }

  // Check if API keys are configured
  async hasApiKeys(): Promise<{ [key in APIProvider]: boolean }> {
    const providers: APIProvider[] = ['openai', 'claude', 'deepseek'];
    const result: { [key in APIProvider]: boolean } = {
      openai: false,
      claude: false,
      deepseek: false,
    };
    
    for (const provider of providers) {
      const key = await this.getApiKey(provider);
      result[provider] = !!key;
    }
    
    return result;
  }

  // Clear all secure storage (use with caution!)
  async clearAll(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(this.webStorageKey);
      } else {
        // For native, we need to remove each item individually
        const providers: APIProvider[] = ['openai', 'claude', 'deepseek'];
        for (const provider of providers) {
          await this.removeApiKey(provider);
        }
      }
      
      this.memoryCache.clear();
      logger.warn('All secure storage cleared');
    } catch (error: unknown) {
      logger.error('Failed to clear secure storage', error);
      throw error;
    }
  }

  // Get web storage object
  private getWebStorage(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.webStorageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  // Validate API key format (basic validation)
  validateApiKey(provider: APIProvider, key: string): boolean {
    if (!key || typeof key !== 'string') return false;
    
    switch (provider) {
      case 'openai':
        // OpenAI keys typically start with 'sk-'
        return key.startsWith('sk-') && key.length > 20;
      case 'claude':
        // Claude keys format may vary
        return key.length > 20;
      case 'deepseek':
        // DeepSeek keys format
        return key.length > 20;
      default:
        return false;
    }
  }
}

// Singleton instance
export const secureStorage = new SecureStorage();

// Type exports
export type { StorageOptions };