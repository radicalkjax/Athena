import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { MalwareFile } from '@/types';
import { detectLanguage, formatFileSize } from '@/utils/helpers';

// Storage paths
const MALWARE_FILES_DIR = FileSystem.documentDirectory + 'malware_files/';
const ANALYSIS_RESULTS_DIR = FileSystem.documentDirectory + 'analysis_results/';

/**
 * Initialize file system directories
 */
export const initFileSystem = async (): Promise<void> => {
  try {
    // Create malware files directory if it doesn't exist
    const malwareDirInfo = await FileSystem.getInfoAsync(MALWARE_FILES_DIR);
    if (!malwareDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MALWARE_FILES_DIR, { intermediates: true });
    }
    
    // Create analysis results directory if it doesn't exist
    const resultsDirInfo = await FileSystem.getInfoAsync(ANALYSIS_RESULTS_DIR);
    if (!resultsDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(ANALYSIS_RESULTS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error initializing file system:', error);
    throw new Error(`Failed to initialize file system: ${(error as Error).message}`);
  }
};

/**
 * Pick a file from the device
 * @returns File information
 */
export const pickFile = async (): Promise<MalwareFile | null> => {
  try {
    await initFileSystem();
    
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: '*/*',
    });
    
    if (result.canceled) {
      return null;
    }
    
    const file = result.assets[0];
    const fileId = Crypto.randomUUID();
    const fileUri = file.uri;
    const fileName = file.name;
    const fileSize = file.size || 0;
    const fileType = file.mimeType || 'application/octet-stream';
    
    // Copy file to app's documents directory
    const destinationUri = MALWARE_FILES_DIR + fileId + '_' + fileName;
    await FileSystem.copyAsync({
      from: fileUri,
      to: destinationUri,
    });
    
    // Read file content for small text files
    let content = '';
    if (
      fileSize < 1024 * 1024 && // Less than 1MB
      (fileType.includes('text') || 
       fileType.includes('javascript') || 
       fileType.includes('json') || 
       fileType.includes('xml') || 
       fileType.includes('html') || 
       fileType.includes('css') ||
       fileName.endsWith('.js') ||
       fileName.endsWith('.py') ||
       fileName.endsWith('.php') ||
       fileName.endsWith('.java') ||
       fileName.endsWith('.c') ||
       fileName.endsWith('.cpp') ||
       fileName.endsWith('.cs') ||
       fileName.endsWith('.go') ||
       fileName.endsWith('.rb') ||
       fileName.endsWith('.pl') ||
       fileName.endsWith('.sh'))
    ) {
      content = await FileSystem.readAsStringAsync(destinationUri);
    }
    
    return {
      id: fileId,
      name: fileName,
      size: fileSize,
      type: fileType,
      uri: destinationUri,
      content,
    };
  } catch (error) {
    console.error('Error picking file:', error);
    throw new Error(`Failed to pick file: ${(error as Error).message}`);
  }
};

/**
 * Read file content
 * @param fileUri URI of the file to read
 * @returns File content as string
 */
export const readFileContent = async (fileUri: string): Promise<string> => {
  try {
    return await FileSystem.readAsStringAsync(fileUri);
  } catch (error) {
    console.error('Error reading file content:', error);
    throw new Error(`Failed to read file content: ${(error as Error).message}`);
  }
};

/**
 * Read file content as base64
 * @param fileUri URI of the file to read
 * @returns File content as base64 string
 */
export const readFileBase64 = async (fileUri: string): Promise<string> => {
  try {
    return await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    console.error('Error reading file as base64:', error);
    throw new Error(`Failed to read file as base64: ${(error as Error).message}`);
  }
};

/**
 * Save analysis result to file
 * @param resultId ID of the analysis result
 * @param content Content to save
 * @returns URI of the saved file
 */
export const saveAnalysisResult = async (resultId: string, content: string): Promise<string> => {
  try {
    await initFileSystem();
    
    const fileName = `result_${resultId}.txt`;
    const fileUri = ANALYSIS_RESULTS_DIR + fileName;
    
    await FileSystem.writeAsStringAsync(fileUri, content);
    
    return fileUri;
  } catch (error) {
    console.error('Error saving analysis result:', error);
    throw new Error(`Failed to save analysis result: ${(error as Error).message}`);
  }
};

/**
 * Delete a file
 * @param fileUri URI of the file to delete
 * @returns True if successful, false otherwise
 */
export const deleteFile = async (fileUri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Get file information
 * @param fileUri URI of the file
 * @returns File information
 */
export const getFileInfo = async (fileUri: string): Promise<any> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    // Try to read the file content for text files
    let content = '';
    let language = 'unknown';
    
    try {
      content = await readFileContent(fileUri);
      language = detectLanguage(content);
    } catch (error) {
      // Not a text file or too large
      content = '';
    }
    
    const size = 'size' in fileInfo ? fileInfo.size : 0;
    
    return {
      ...fileInfo,
      size,
      formattedSize: formatFileSize(size),
      content: content.length > 0 ? content : null,
      language: content.length > 0 ? language : null,
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    throw new Error(`Failed to get file info: ${(error as Error).message}`);
  }
};

/**
 * Create a text file with content
 * @param fileName Name of the file
 * @param content Content to write
 * @returns File information
 */
export const createTextFile = async (fileName: string, content: string): Promise<MalwareFile> => {
  try {
    await initFileSystem();
    
    const fileId = Crypto.randomUUID();
    const fileUri = MALWARE_FILES_DIR + fileId + '_' + fileName;
    
    await FileSystem.writeAsStringAsync(fileUri, content);
    
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    const size = 'size' in fileInfo ? fileInfo.size : 0;
    
    return {
      id: fileId,
      name: fileName,
      size,
      type: 'text/plain',
      uri: fileUri,
      content,
    };
  } catch (error) {
    console.error('Error creating text file:', error);
    throw new Error(`Failed to create text file: ${(error as Error).message}`);
  }
};

/**
 * List all malware files
 * @returns Array of file information
 */
export const listMalwareFiles = async (): Promise<MalwareFile[]> => {
  try {
    await initFileSystem();
    
    const files = await FileSystem.readDirectoryAsync(MALWARE_FILES_DIR);
    const malwareFiles: MalwareFile[] = [];
    
    for (const file of files) {
      const fileUri = MALWARE_FILES_DIR + file;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const size = 'size' in fileInfo ? fileInfo.size : 0;
      
      // Extract file ID and name from the filename (format: id_name)
      const parts = file.split('_');
      const fileId = parts[0];
      const fileName = parts.slice(1).join('_');
      
      malwareFiles.push({
        id: fileId,
        name: fileName,
        size,
        type: 'application/octet-stream', // Default type
        uri: fileUri,
      });
    }
    
    return malwareFiles;
  } catch (error) {
    console.error('Error listing malware files:', error);
    return [];
  }
};

/**
 * List all analysis results
 * @returns Array of file information
 */
export const listAnalysisResults = async (): Promise<any[]> => {
  try {
    await initFileSystem();
    
    const files = await FileSystem.readDirectoryAsync(ANALYSIS_RESULTS_DIR);
    const resultFiles: any[] = [];
    
    for (const file of files) {
      const fileUri = ANALYSIS_RESULTS_DIR + file;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const size = 'size' in fileInfo ? fileInfo.size : 0;
      
      // Extract result ID from the filename (format: result_id.txt)
      const resultId = file.replace('result_', '').replace('.txt', '');
      
      resultFiles.push({
        id: resultId,
        name: file,
        size,
        uri: fileUri,
      });
    }
    
    return resultFiles;
  } catch (error) {
    console.error('Error listing analysis results:', error);
    return [];
  }
};
