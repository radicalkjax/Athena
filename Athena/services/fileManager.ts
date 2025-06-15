import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { MalwareFile } from '@/types';
import { createFileProcessor, type IFileProcessor, type ParsedFile, type FileValidation } from '../../wasm-modules/bridge/file-processor-bridge';

/**
 * File Manager Service
 * Handles file operations for malware analysis
 * Enhanced with WASM file processing capabilities
 */

// Singleton instance of the file processor
let fileProcessor: IFileProcessor | null = null;

/**
 * Initialize the WASM file processor
 */
async function initFileProcessor(): Promise<IFileProcessor> {
  if (!fileProcessor) {
    try {
      fileProcessor = createFileProcessor();
      await fileProcessor.initialize();
      console.log('WASM file processor initialized successfully');
    } catch (error: unknown) {
      console.error('Failed to initialize WASM file processor:', error);
      // Fallback to JS implementation if WASM fails
      fileProcessor = null;
    }
  }
  return fileProcessor!;
}

export interface FileInfo {
  uri: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Initialize the file system (create directories if needed)
 */
export async function initFileSystem(): Promise<void> {
  try {
    // Ensure the document directory exists
    const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, { intermediates: true });
    }
  } catch (error: unknown) {
    console.error('Error initializing file system:', error);
    throw new Error('Failed to initialize file system');
  }
}

/**
 * Validate a file using WASM processor
 */
async function validateFileWithWASM(uri: string, size: number): Promise<FileValidation | null> {
  try {
    const processor = await initFileProcessor();
    if (!processor) return null;

    // Read file as base64 and convert to ArrayBuffer
    const base64Content = await readFileAsBase64(uri);
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    // Validate the file
    const validation = await processor.validateFile(buffer);
    return validation;
  } catch (error: unknown) {
    console.error('WASM file validation failed:', error);
    return null;
  }
}

/**
 * Parse a file using WASM processor
 */
async function parseFileWithWASM(uri: string, formatHint?: string): Promise<ParsedFile | null> {
  try {
    const processor = await initFileProcessor();
    if (!processor) return null;

    // Read file as base64 and convert to ArrayBuffer
    const base64Content = await readFileAsBase64(uri);
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    // Parse the file
    const parsed = await processor.parseFile(buffer, formatHint);
    return parsed;
  } catch (error: unknown) {
    console.error('WASM file parsing failed:', error);
    return null;
  }
}

/**
 * Pick a file using the document picker
 */
export async function pickFile(): Promise<MalwareFile | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      
      // Try to validate and parse with WASM first
      let wasmValidation: FileValidation | null = null;
      let wasmParsed: ParsedFile | null = null;
      
      try {
        // Performance tracking
        const startTime = Date.now();
        
        // Validate the file
        wasmValidation = await validateFileWithWASM(asset.uri, asset.size || 0);
        
        // Parse the file if validation passed
        if (wasmValidation?.isValid) {
          wasmParsed = await parseFileWithWASM(asset.uri, asset.mimeType || undefined);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`WASM file processing completed in ${processingTime}ms`);
      } catch (error: unknown) {
        console.warn('WASM processing failed, falling back to JS:', error);
      }
      
      // Read file content for small text files (fallback or for content display)
      let content = '';
      const isTextFile = wasmParsed ? 
        ['text', 'script', 'json', 'xml', 'html'].some(type => 
          wasmParsed.format.toLowerCase().includes(type)
        ) :
        (asset.mimeType?.includes('text') || 
         asset.mimeType?.includes('javascript') || 
         asset.mimeType?.includes('json') || 
         asset.mimeType?.includes('xml') || 
         asset.mimeType?.includes('html') || 
         asset.mimeType?.includes('css') ||
         asset.name.endsWith('.js') ||
         asset.name.endsWith('.py') ||
         asset.name.endsWith('.php') ||
         asset.name.endsWith('.java') ||
         asset.name.endsWith('.c') ||
         asset.name.endsWith('.cpp') ||
         asset.name.endsWith('.cs') ||
         asset.name.endsWith('.go') ||
         asset.name.endsWith('.rb') ||
         asset.name.endsWith('.pl') ||
         asset.name.endsWith('.sh'));
      
      if (asset.size && asset.size < 1024 * 1024 && isTextFile) {
        try {
          content = await readFileAsText(asset.uri);
        } catch (error: unknown) {
          console.warn('Could not read file content as text:', error);
        }
      }
      
      // Create enhanced MalwareFile object
      const malwareFile: MalwareFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: asset.name,
        size: asset.size || 0,
        type: wasmParsed?.metadata?.mimeType || asset.mimeType || 'application/octet-stream',
        uri: asset.uri,
        content,
        // Add WASM analysis results
        wasmAnalysis: wasmParsed ? {
          format: wasmParsed.format,
          metadata: wasmParsed.metadata,
          suspiciousIndicators: wasmParsed.suspicious_indicators,
          extractedStrings: wasmParsed.strings.filter((s: any) => s.suspicious).length,
          entropy: wasmParsed.metadata.entropy,
          validStructure: wasmParsed.integrity.validStructure,
        } : undefined,
        validationErrors: wasmValidation?.errors,
        validationWarnings: wasmValidation?.warnings,
      };
      
      return malwareFile;
    }
    
    return null;
  } catch (error: unknown) {
    console.error('Error picking file:', error);
    throw new Error('Failed to pick file');
  }
}

/**
 * List malware files from storage
 */
export async function listMalwareFiles(): Promise<MalwareFile[]> {
  try {
    const files = await listFiles();
    const malwareFiles: MalwareFile[] = [];
    
    for (const fileName of files) {
      try {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        const malwareFile = await createMalwareFile(fileUri, fileName);
        malwareFiles.push(malwareFile);
      } catch (error: unknown) {
        console.warn(`Could not create malware file for ${fileName}:`, error);
      }
    }
    
    return malwareFiles;
  } catch (error: unknown) {
    console.error('Error listing malware files:', error);
    throw new Error('Failed to list malware files');
  }
}

/**
 * Save a file to the app's document directory
 */
export async function saveFile(file: FileInfo): Promise<string> {
  try {
    const fileName = `${Date.now()}_${file.name}`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    // Copy the file to our document directory
    await FileSystem.copyAsync({
      from: file.uri,
      to: fileUri,
    });
    
    return fileUri;
  } catch (error: unknown) {
    console.error('Error saving file:', error);
    throw new Error('Failed to save file');
  }
}

/**
 * Read file content as text
 */
export async function readFileAsText(uri: string): Promise<string> {
  try {
    const content = await FileSystem.readAsStringAsync(uri);
    return content;
  } catch (error: unknown) {
    console.error('Error reading file:', error);
    throw new Error('Failed to read file');
  }
}

/**
 * Read file content as base64
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  try {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return content;
  } catch (error: unknown) {
    console.error('Error reading file as base64:', error);
    throw new Error('Failed to read file as base64');
  }
}

/**
 * Get file info
 */
export async function getFileInfo(uri: string): Promise<FileSystem.FileInfo> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info;
  } catch (error: unknown) {
    console.error('Error getting file info:', error);
    throw new Error('Failed to get file info');
  }
}

/**
 * Delete a file
 */
export async function deleteFile(uri: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(uri);
    return true;
  } catch (error: unknown) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Create a MalwareFile object from a file URI
 */
export async function createMalwareFile(uri: string, name?: string): Promise<MalwareFile> {
  try {
    const info = await getFileInfo(uri);
    
    if (!info.exists) {
      throw new Error('File does not exist');
    }
    
    const fileName = name || uri.split('/').pop() || 'unknown';
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Determine file type based on extension
    let fileType = 'application/octet-stream';
    if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
      fileType = 'text/javascript';
    } else if (['py'].includes(fileExtension)) {
      fileType = 'text/x-python';
    } else if (['txt', 'md'].includes(fileExtension)) {
      fileType = 'text/plain';
    } else if (['exe', 'dll'].includes(fileExtension)) {
      fileType = 'application/x-msdownload';
    }
    
    // Read content for small text files
    let content = '';
    if (
      info.size && info.size < 1024 * 1024 && // Less than 1MB
      (fileType.includes('text') || 
       fileType.includes('javascript') || 
       ['js', 'py', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'pl', 'sh'].includes(fileExtension))
    ) {
      try {
        content = await readFileAsText(uri);
      } catch (error: unknown) {
        console.warn('Could not read file content as text:', error);
      }
    }
    
    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: fileName,
      size: info.size || 0,
      type: fileType,
      uri: uri,
      content,
    };
  } catch (error: unknown) {
    console.error('Error creating malware file:', error);
    throw new Error('Failed to create malware file object');
  }
}

/**
 * List files in the app's document directory
 */
export async function listFiles(): Promise<string[]> {
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
    return files;
  } catch (error: unknown) {
    console.error('Error listing files:', error);
    throw new Error('Failed to list files');
  }
}

/**
 * Clean up old files (older than specified days)
 */
export async function cleanupOldFiles(daysOld: number = 7): Promise<number> {
  try {
    const files = await listFiles();
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const fileName of files) {
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      const info = await getFileInfo(fileUri);
      
      if (info.exists && info.modificationTime && info.modificationTime < cutoffTime) {
        const deleted = await deleteFile(fileUri);
        if (deleted) {
          deletedCount++;
        }
      }
    }
    
    return deletedCount;
  } catch (error: unknown) {
    console.error('Error cleaning up old files:', error);
    throw new Error('Failed to cleanup old files');
  }
}

/**
 * Cleanup WASM file processor resources
 */
export function cleanupFileProcessor(): void {
  if (fileProcessor) {
    try {
      fileProcessor.destroy();
      fileProcessor = null;
      console.log('WASM file processor cleaned up');
    } catch (error: unknown) {
      console.error('Error cleaning up WASM file processor:', error);
    }
  }
}
