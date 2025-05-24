/**
 * Utility helper functions
 */

/**
 * Format file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string for safe use in API calls and display
 */
export function sanitizeString(str: string): string {
  if (!str) return '';
  
  // Remove or escape potentially dangerous characters
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Check if code appears to be obfuscated
 */
export function isObfuscatedCode(code: string): boolean {
  // Simple heuristics to detect obfuscated code
  const indicators = [
    // Very long variable names with random characters
    /[a-zA-Z_$][a-zA-Z0-9_$]{50,}/,
    // Excessive use of escape sequences
    /\\x[0-9a-fA-F]{2}/g,
    // Base64-like strings
    /[A-Za-z0-9+/]{50,}={0,2}/,
    // Excessive string concatenation
    /\+\s*["'][^"']*["']\s*\+/g,
    // eval() or Function() calls
    /\b(eval|Function)\s*\(/,
    // Hexadecimal strings
    /0x[0-9a-fA-F]{8,}/g,
  ];
  
  let score = 0;
  indicators.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      score += matches.length;
    }
  });
  
  // If we find multiple indicators, it's likely obfuscated
  return score > 3;
}

/**
 * Extract strings from code that might be URLs, IPs, or domains
 */
export function extractSuspiciousStrings(code: string): string[] {
  const patterns = [
    // URLs
    /https?:\/\/[^\s"']+/g,
    // IP addresses
    /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    // Domain names
    /\b[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})\b/g,
    // Base64 strings (potential encoded data)
    /[A-Za-z0-9+/]{20,}={0,2}/g,
  ];
  
  const results: string[] = [];
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      results.push(...matches);
    }
  });
  
  // Remove duplicates and return
  return [...new Set(results)];
}
