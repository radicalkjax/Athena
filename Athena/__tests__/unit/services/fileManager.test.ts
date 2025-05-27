import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import {
  initFileSystem,
  pickFile,
  listMalwareFiles,
  saveFile,
  readFileAsText,
  readFileAsBase64,
  getFileInfo,
  deleteFile,
  createMalwareFile,
  listFiles,
  cleanupOldFiles
} from '@/services/fileManager';
import type { MalwareFile } from '@/types';

// Mock expo modules
jest.mock('expo-file-system');
jest.mock('expo-document-picker');

describe('FileManager Service', () => {
  const mockDocumentDirectory = 'file:///test/';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initFileSystem', () => {
    it('should initialize file system when directory exists', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: true } as any);
      
      await initFileSystem();
      
      expect(mockGetInfoAsync).toHaveBeenCalledWith(mockDocumentDirectory);
      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    it('should create directory when it does not exist', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockMakeDirectoryAsync = jest.mocked(FileSystem.makeDirectoryAsync);
      
      mockGetInfoAsync.mockResolvedValue({ exists: false, isDirectory: false } as any);
      mockMakeDirectoryAsync.mockResolvedValue(undefined);
      
      await initFileSystem();
      
      expect(mockGetInfoAsync).toHaveBeenCalledWith(mockDocumentDirectory);
      expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(mockDocumentDirectory, { intermediates: true });
    });

    it('should throw error when initialization fails', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      mockGetInfoAsync.mockRejectedValue(new Error('File system error'));
      
      await expect(initFileSystem()).rejects.toThrow('Failed to initialize file system');
    });
  });

  describe('pickFile', () => {
    it('should return MalwareFile when file is picked successfully', async () => {
      const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      
      const mockAsset = {
        name: 'test.js',
        size: 500,
        uri: 'file:///test.js',
        mimeType: 'text/javascript'
      };
      
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [mockAsset]
      } as any);
      
      mockReadAsStringAsync.mockResolvedValue('console.log("test");');
      
      const result = await pickFile();
      
      expect(result).toMatchObject({
        name: 'test.js',
        size: 500,
        uri: 'file:///test.js',
        type: 'text/javascript',
        content: 'console.log("test");'
      });
      expect(result?.id).toMatch(/^file_\d+_[a-z0-9]+$/);
    });

    it('should return null when picker is canceled', async () => {
      const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
      
      mockGetDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: []
      } as any);
      
      const result = await pickFile();
      
      expect(result).toBeNull();
    });

    it('should handle binary files without reading content', async () => {
      const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
      
      const mockAsset = {
        name: 'malware.exe',
        size: 2048000, // 2MB
        uri: 'file:///malware.exe',
        mimeType: 'application/x-msdownload'
      };
      
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [mockAsset]
      } as any);
      
      const result = await pickFile();
      
      expect(result).toMatchObject({
        name: 'malware.exe',
        size: 2048000,
        uri: 'file:///malware.exe',
        type: 'application/x-msdownload',
        content: ''
      });
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('should throw error when picker fails', async () => {
      const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
      mockGetDocumentAsync.mockRejectedValue(new Error('Picker error'));
      
      await expect(pickFile()).rejects.toThrow('Failed to pick file');
    });
  });

  describe('saveFile', () => {
    it('should save file to document directory', async () => {
      const mockCopyAsync = jest.mocked(FileSystem.copyAsync);
      mockCopyAsync.mockResolvedValue(undefined);
      
      const fileInfo = {
        uri: 'file:///source/test.txt',
        name: 'test.txt',
        size: 100,
        type: 'text/plain'
      };
      
      const result = await saveFile(fileInfo);
      
      expect(result).toMatch(new RegExp(`^${mockDocumentDirectory}\\d+_test\\.txt$`));
      expect(mockCopyAsync).toHaveBeenCalledWith({
        from: fileInfo.uri,
        to: expect.stringMatching(new RegExp(`^${mockDocumentDirectory}\\d+_test\\.txt$`))
      });
    });

    it('should throw error when save fails', async () => {
      const mockCopyAsync = jest.mocked(FileSystem.copyAsync);
      mockCopyAsync.mockRejectedValue(new Error('Copy error'));
      
      const fileInfo = {
        uri: 'file:///source/test.txt',
        name: 'test.txt',
        size: 100,
        type: 'text/plain'
      };
      
      await expect(saveFile(fileInfo)).rejects.toThrow('Failed to save file');
    });
  });

  describe('readFileAsText', () => {
    it('should read file content as text', async () => {
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      mockReadAsStringAsync.mockResolvedValue('File content');
      
      const result = await readFileAsText('file:///test.txt');
      
      expect(result).toBe('File content');
      expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///test.txt');
    });

    it('should throw error when read fails', async () => {
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      mockReadAsStringAsync.mockRejectedValue(new Error('Read error'));
      
      await expect(readFileAsText('file:///test.txt')).rejects.toThrow('Failed to read file');
    });
  });

  describe('readFileAsBase64', () => {
    it('should read file content as base64', async () => {
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      mockReadAsStringAsync.mockResolvedValue('SGVsbG8gV29ybGQ=');
      
      const result = await readFileAsBase64('file:///test.txt');
      
      expect(result).toBe('SGVsbG8gV29ybGQ=');
      expect(mockReadAsStringAsync).toHaveBeenCalledWith(
        'file:///test.txt',
        { encoding: 'base64' }
      );
    });

    it('should throw error when read fails', async () => {
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      mockReadAsStringAsync.mockRejectedValue(new Error('Read error'));
      
      await expect(readFileAsBase64('file:///test.txt')).rejects.toThrow('Failed to read file as base64');
    });
  });

  describe('getFileInfo', () => {
    it('should return file info', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now()
      };
      
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      mockGetInfoAsync.mockResolvedValue(mockFileInfo as any);
      
      const result = await getFileInfo('file:///test.txt');
      
      expect(result).toEqual(mockFileInfo);
      expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///test.txt');
    });

    it('should throw error when get info fails', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      mockGetInfoAsync.mockRejectedValue(new Error('Info error'));
      
      await expect(getFileInfo('file:///test.txt')).rejects.toThrow('Failed to get file info');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockDeleteAsync = jest.mocked(FileSystem.deleteAsync);
      mockDeleteAsync.mockResolvedValue(undefined);
      
      const result = await deleteFile('file:///test.txt');
      
      expect(result).toBe(true);
      expect(mockDeleteAsync).toHaveBeenCalledWith('file:///test.txt');
    });

    it('should return false when delete fails', async () => {
      const mockDeleteAsync = jest.mocked(FileSystem.deleteAsync);
      mockDeleteAsync.mockRejectedValue(new Error('Delete error'));
      
      const result = await deleteFile('file:///test.txt');
      
      expect(result).toBe(false);
    });
  });

  describe('createMalwareFile', () => {
    it('should create MalwareFile from JavaScript file', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 500,
        isDirectory: false,
        modificationTime: Date.now()
      } as any);
      
      mockReadAsStringAsync.mockResolvedValue('const x = 1;');
      
      const result = await createMalwareFile('file:///test.js', 'test.js');
      
      expect(result).toMatchObject({
        name: 'test.js',
        size: 500,
        type: 'text/javascript',
        uri: 'file:///test.js',
        content: 'const x = 1;'
      });
      expect(result.id).toMatch(/^file_\d+_[a-z0-9]+$/);
    });

    it('should create MalwareFile from Python file', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 300,
        isDirectory: false
      } as any);
      
      mockReadAsStringAsync.mockResolvedValue('print("Hello")');
      
      const result = await createMalwareFile('file:///script.py');
      
      expect(result).toMatchObject({
        name: 'script.py',
        size: 300,
        type: 'text/x-python',
        uri: 'file:///script.py',
        content: 'print("Hello")'
      });
    });

    it('should create MalwareFile from binary file without content', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048000, // 2MB
        isDirectory: false
      } as any);
      
      const result = await createMalwareFile('file:///malware.exe');
      
      expect(result).toMatchObject({
        name: 'malware.exe',
        size: 2048000,
        type: 'application/x-msdownload',
        uri: 'file:///malware.exe',
        content: ''
      });
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('should throw error when file does not exist', async () => {
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      mockGetInfoAsync.mockResolvedValue({ exists: false } as any);
      
      await expect(createMalwareFile('file:///missing.txt')).rejects.toThrow('Failed to create malware file object');
    });
  });

  describe('listFiles', () => {
    it('should list files in document directory', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      mockReadDirectoryAsync.mockResolvedValue(['file1.txt', 'file2.js', 'file3.exe']);
      
      const result = await listFiles();
      
      expect(result).toEqual(['file1.txt', 'file2.js', 'file3.exe']);
      expect(mockReadDirectoryAsync).toHaveBeenCalledWith(mockDocumentDirectory);
    });

    it('should throw error when listing fails', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      mockReadDirectoryAsync.mockRejectedValue(new Error('Directory error'));
      
      await expect(listFiles()).rejects.toThrow('Failed to list files');
    });
  });

  describe('listMalwareFiles', () => {
    it('should list and create MalwareFile objects', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync);
      
      mockReadDirectoryAsync.mockResolvedValue(['test.js', 'malware.exe']);
      
      mockGetInfoAsync
        .mockResolvedValueOnce({
          exists: true,
          size: 100,
          isDirectory: false
        } as any)
        .mockResolvedValueOnce({
          exists: true,
          size: 2048000,
          isDirectory: false
        } as any);
      
      mockReadAsStringAsync.mockResolvedValue('console.log("test");');
      
      const result = await listMalwareFiles();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'test.js',
        size: 100,
        type: 'text/javascript'
      });
      expect(result[1]).toMatchObject({
        name: 'malware.exe',
        size: 2048000,
        type: 'application/x-msdownload'
      });
    });

    it('should handle errors for individual files gracefully', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      
      mockReadDirectoryAsync.mockResolvedValue(['good.txt', 'bad.txt']);
      
      mockGetInfoAsync
        .mockResolvedValueOnce({
          exists: true,
          size: 100,
          isDirectory: false
        } as any)
        .mockRejectedValueOnce(new Error('File error'));
      
      const result = await listMalwareFiles();
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'good.txt'
      });
    });
  });

  describe('cleanupOldFiles', () => {
    it('should delete files older than specified days', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockDeleteAsync = jest.mocked(FileSystem.deleteAsync);
      
      const cutoffTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      
      mockReadDirectoryAsync.mockResolvedValue(['old.txt', 'new.txt']);
      
      mockGetInfoAsync
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: cutoffTime - 1000, // Older than cutoff
          isDirectory: false
        } as any)
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: Date.now(), // Recent file
          isDirectory: false
        } as any);
      
      mockDeleteAsync.mockResolvedValue(undefined);
      
      const result = await cleanupOldFiles(7);
      
      expect(result).toBe(1);
      expect(mockDeleteAsync).toHaveBeenCalledTimes(1);
      expect(mockDeleteAsync).toHaveBeenCalledWith(`${mockDocumentDirectory}old.txt`);
    });

    it('should handle delete failures gracefully', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
      const mockDeleteAsync = jest.mocked(FileSystem.deleteAsync);
      
      const cutoffTime = Date.now() - (8 * 24 * 60 * 60 * 1000);
      
      mockReadDirectoryAsync.mockResolvedValue(['old1.txt', 'old2.txt']);
      
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        modificationTime: cutoffTime - 1000,
        isDirectory: false
      } as any);
      
      mockDeleteAsync
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));
      
      const result = await cleanupOldFiles(7);
      
      expect(result).toBe(1); // Only one successful deletion
    });

    it('should throw error when cleanup fails completely', async () => {
      const mockReadDirectoryAsync = jest.mocked(FileSystem.readDirectoryAsync);
      mockReadDirectoryAsync.mockRejectedValue(new Error('Directory error'));
      
      await expect(cleanupOldFiles()).rejects.toThrow('Failed to cleanup old files');
    });
  });
});