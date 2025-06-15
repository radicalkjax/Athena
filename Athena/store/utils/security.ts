import crypto from 'crypto';
import { MalwareSample } from '../types/security';

// Encryption key derivation (in production, this should come from secure storage)
const ENCRYPTION_KEY = process.env.MALWARE_ENCRYPTION_KEY || 'default-dev-key-do-not-use-in-production';

/**
 * Encrypts malware content before storing
 * @param content The raw malware content
 * @returns Base64 encoded encrypted content
 */
export function encryptMalwareContent(content: string): string {
  try {
    // Create a cipher
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    // Encrypt the content
    let encrypted = cipher.update(content, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted content
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
    
    return combined.toString('base64');
  } catch (error: unknown) {
    throw new Error('Failed to encrypt malware content');
  }
}

/**
 * Decrypts malware content for analysis
 * @param encryptedContent Base64 encoded encrypted content
 * @returns Decrypted malware content
 */
export function decryptMalwareContent(encryptedContent: string): string {
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedContent, 'base64');
    
    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    // Create decipher
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: unknown) {
    throw new Error('Failed to decrypt malware content');
  }
}

/**
 * Generates a SHA256 hash of the malware content
 * @param content The malware content
 * @returns SHA256 hash
 */
export function hashMalwareContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates a secure malware sample object
 * @param file File data
 * @param content File content
 * @returns MalwareSample object with encrypted content
 */
export function createSecureMalwareSample(
  file: { name: string; size: number; type: string },
  content: string,
  source?: string
): MalwareSample {
  const id = `malware-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const hash = hashMalwareContent(content);
  const encryptedContent = encryptMalwareContent(content);
  
  return {
    id,
    hash,
    encryptedContent,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      captureDate: Date.now(),
      source,
    },
  };
}

/**
 * Sanitizes malware data before display or logging
 * @param data Any data that might contain malware
 * @returns Sanitized data safe for display
 */
export function sanitizeMalwareData<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data };
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['content', 'encryptedContent', 'deobfuscatedCode', 'payload'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}