import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { MalwareFile } from '@/types';
import { useAppStore } from '@/store';
import * as fileManagerService from '@/services/fileManager';
import { useColorScheme } from '@/hooks';
import { Colors } from '@/constants/Colors';
import { formatFileSize, truncateString } from '@/utils/helpers';
import { AiFillAliwangwang } from 'react-icons/ai';
import { FaTrash } from 'react-icons/fa';
import { Button, Card, Toast } from '@/design-system';

interface FileUploaderProps {
  onFileSelect: (file: MalwareFile) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  const { malwareFiles, selectedMalwareId, selectMalwareFile, addMalwareFile, removeMalwareFile } = useAppStore(state => ({
    malwareFiles: state.malwareFiles,
    selectedMalwareId: state.selectedMalwareId,
    selectMalwareFile: state.selectMalwareFile,
    addMalwareFile: state.addMalwareFile,
    removeMalwareFile: state.removeMalwareFile,
  }));
  
  useEffect(() => {
    loadMalwareFiles();
  }, []);
  
  const loadMalwareFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if running on web
      const isWeb = typeof document !== 'undefined';
      
      if (isWeb) {
        console.log('Using web implementation for loading files');
        // On web, we can't load files from the file system
        // We'll just check if there are any files in the store
        
        // If a file is already selected, make sure it's in the malware files
        if (selectedMalwareId) {
          const selectedFile = malwareFiles.find(file => file.id === selectedMalwareId);
          if (selectedFile) {
            onFileSelect(selectedFile);
          }
        }
      } else {
        console.log('Using native implementation for loading files');
        // Initialize file system
        await fileManagerService.initFileSystem();
        
        // Load existing malware files if the store is empty
        if (malwareFiles.length === 0) {
          const files = await fileManagerService.listMalwareFiles();
          files.forEach(file => {
            addMalwareFile(file);
          });
        }
        
        // If a file is already selected, make sure it's in the malware files
        if (selectedMalwareId) {
          const selectedFile = malwareFiles.find(file => file.id === selectedMalwareId);
          if (selectedFile) {
            onFileSelect(selectedFile);
          }
        }
      }
    } catch (error) {
      console.error('Error loading malware files:', error);
      setError('Failed to load malware files.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileUpload = async () => {
    try {
      setError(null);
      
      console.log('Starting file upload process...');
      
      // Check if running on web
      const isWeb = typeof document !== 'undefined';
      
      if (isWeb) {
        // Web implementation using standard File API
        console.log('Using web file upload implementation');
        
        // Create a file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        
        // Create a promise to handle the file selection
        let handleFocus: (() => void) | null = null;
        
        const filePromise = new Promise<File | null>((resolve) => {
          let fileSelected = false;
          
          input.onchange = (e) => {
            fileSelected = true;
            const target = e.target as HTMLInputElement;
            const files = target.files;
            
            if (files && files.length > 0) {
              resolve(files[0]);
            } else {
              resolve(null);
            }
          };
          
          // Handle cancel - when input loses focus without a file being selected
          input.addEventListener('cancel', () => {
            console.log('File selection cancelled');
            resolve(null);
          });
          
          // Fallback for browsers that don't support cancel event
          // Use a longer timeout to ensure file processing completes
          setTimeout(() => {
            if (!fileSelected) {
              console.log('File selection timed out - likely cancelled');
              resolve(null);
            }
          }, 60000); // 60 seconds timeout
          
          // Also handle focus events as a fallback
          handleFocus = () => {
            setTimeout(() => {
              if (!fileSelected && document.activeElement !== input) {
                console.log('File dialog closed without selection');
                resolve(null);
              }
            }, 500);
          };
          
          window.addEventListener('focus', handleFocus);
          
          // Trigger the file dialog
          input.click();
        });
        
        // Clean up the event listener when done
        filePromise.finally(() => {
          if (handleFocus) {
            window.removeEventListener('focus', handleFocus);
          }
        });
        
        // Wait for file selection
        const selectedFile = await filePromise;
        console.log('File selection result:', selectedFile ? 'File selected' : 'No file selected');
        
        if (selectedFile) {
          // Set loading state and process the file
          setLoading(true);
          setUploadProgress(0);
          
          console.log('Processing selected file:', selectedFile.name);
          const malwareFile = await processFile(selectedFile);
          
          if (malwareFile) {
            // Add file to store
            addMalwareFile(malwareFile);
            console.log('File added to store');
            
            // Select the file
            selectMalwareFile(malwareFile.id);
            onFileSelect(malwareFile);
            console.log('File selected for analysis');
            
            // Show success message
            setUploadProgress(100);
            setToast({
              visible: true,
              message: `File "${malwareFile.name}" uploaded successfully.`,
              type: 'success'
            });
            
            // Reset progress and loading state after a delay
            setTimeout(() => {
              setUploadProgress(0);
              setLoading(false);
            }, 1000);
          } else {
            console.log('Failed to process file');
            setLoading(false);
            setUploadProgress(0);
          }
        } else {
          console.log('No file was selected or the picker was cancelled');
          setUploadProgress(0);
          setLoading(false);
        }
      } else {
        // Native implementation using Expo File System
        console.log('Using native file upload implementation');
        
        // Initialize file system first
        await fileManagerService.initFileSystem();
        console.log('File system initialized');
        
        // Pick a file
        console.log('Opening document picker...');
        const file = await fileManagerService.pickFile();
        console.log('Document picker result:', file ? 'File selected' : 'No file selected');
        
        if (file) {
          setLoading(true);
          setUploadProgress(0);
          console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
          
          // Add file to store
          addMalwareFile(file);
          console.log('File added to store');
          
          // Select the file
          selectMalwareFile(file.id);
          onFileSelect(file);
          console.log('File selected for analysis');
          
          // Show success message
          setUploadProgress(100);
          setToast({
            visible: true,
            message: `File "${file.name}" uploaded successfully.`,
            type: 'success'
          });
          
          // Reset progress and loading state after a delay
          setTimeout(() => {
            setUploadProgress(0);
            setLoading(false);
          }, 1000);
        } else {
          console.log('No file was selected or the picker was cancelled');
          setUploadProgress(0);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to upload file: ${errorMessage}`);
      setToast({
        visible: true,
        message: `Failed to upload file: ${errorMessage}`,
        type: 'error'
      });
      setLoading(false);
      setUploadProgress(0);
    }
  };
  
  const handleFileSelect = (file: MalwareFile) => {
    selectMalwareFile(file.id);
    onFileSelect(file);
  };
  
  const processFile = async (file: File): Promise<MalwareFile | null> => {
    try {
      console.log('processFile: Starting to process file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Simulate progress for file processing
      setUploadProgress(20);
      console.log('processFile: Progress set to 20%');
      
      // Read file content for small text files
      let content = '';
      const shouldReadContent = file.size < 1024 * 1024 && // Less than 1MB
        (file.type.includes('text') || 
         file.type.includes('javascript') || 
         file.type.includes('json') || 
         file.type.includes('xml') || 
         file.type.includes('html') || 
         file.type.includes('css') ||
         file.name.endsWith('.js') ||
         file.name.endsWith('.py') ||
         file.name.endsWith('.php') ||
         file.name.endsWith('.java') ||
         file.name.endsWith('.c') ||
         file.name.endsWith('.cpp') ||
         file.name.endsWith('.cs') ||
         file.name.endsWith('.go') ||
         file.name.endsWith('.rb') ||
         file.name.endsWith('.pl') ||
         file.name.endsWith('.sh'));
         
      console.log('processFile: Should read content?', shouldReadContent);
      
      if (shouldReadContent) {
        console.log('processFile: Reading file content...');
        const reader = new FileReader();
        
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = 20 + (event.loaded / event.total) * 60;
            console.log('processFile: File read progress:', progress);
            setUploadProgress(progress);
          }
        };
        
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            console.log('processFile: File read complete');
            setUploadProgress(80);
            resolve(reader.result as string);
          };
          reader.onerror = (error) => {
            console.error('processFile: FileReader error:', error);
            reject(error);
          };
          console.log('processFile: Starting FileReader.readAsText()');
          reader.readAsText(file);
        });
        console.log('processFile: Content read, length:', content.length);
      } else {
        console.log('processFile: Skipping content read for non-text file');
        setUploadProgress(80);
      }
      
      // Create a MalwareFile object
      const fileId = Math.random().toString(36).substring(2, 15);
      console.log('processFile: Generated file ID:', fileId);
      
      const blobUrl = URL.createObjectURL(file);
      console.log('processFile: Created blob URL:', blobUrl);
      
      const malwareFile: MalwareFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uri: blobUrl,
        content,
      };
      
      setUploadProgress(90);
      console.log('processFile: Progress set to 90%, file object created');
      console.log('processFile: Returning malware file object with ID:', malwareFile.id);
      return malwareFile;
    } catch (error) {
      console.error('processFile: Error processing file:', error);
      setUploadProgress(0);
      throw error;
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0]; // Only handle first file
      
      try {
        setLoading(true);
        setUploadProgress(0);
        setError(null);
        
        const malwareFile = await processFile(file);
        
        if (malwareFile) {
          // Add file to store
          addMalwareFile(malwareFile);
          
          // Select the file
          selectMalwareFile(malwareFile.id);
          onFileSelect(malwareFile);
          
          // Show success message
          setUploadProgress(100);
          setToast({
            visible: true,
            message: `File "${malwareFile.name}" uploaded successfully.`,
            type: 'success'
          });
          
          // Reset progress after a delay
          setTimeout(() => setUploadProgress(0), 1000);
        }
      } catch (error) {
        console.error('Error handling dropped file:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to upload file: ${errorMessage}`);
        setToast({
          visible: true,
          message: `Failed to upload file: ${errorMessage}`,
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileDelete = async (fileId: string) => {
    console.log('Delete button clicked for file ID:', fileId);
    
    try {
      // Check if the file exists in the store
      const fileToDelete = malwareFiles.find(f => f.id === fileId);
      if (!fileToDelete) {
        console.error('File not found in store:', fileId);
        setToast({
          visible: true,
          message: 'File not found.',
          type: 'error'
        });
        return;
      }
      
      console.log('File to delete:', fileToDelete.name);
      
      // Check if running on web
      const isWeb = typeof document !== 'undefined';
      
      if (isWeb) {
        console.log('Using web implementation for deleting file');
        // On web, we just need to revoke the blob URL if it exists
        if (fileToDelete.uri && fileToDelete.uri.startsWith('blob:')) {
          console.log('Revoking blob URL:', fileToDelete.uri);
          URL.revokeObjectURL(fileToDelete.uri);
        }
      } else {
        console.log('Using native implementation for deleting file');
        // Delete file from file system
        console.log('Deleting file from file system:', fileToDelete.uri);
        const deleteResult = await fileManagerService.deleteFile(fileToDelete.uri);
        console.log('Delete file result:', deleteResult);
      }
      
      console.log('Removing file from store:', fileId);
      // Remove file from store
      removeMalwareFile(fileId);
      
      // Log the current state of the store
      const currentFiles = useAppStore.getState().malwareFiles;
      console.log('Current files in store after removal:', currentFiles.length);
      currentFiles.forEach(f => console.log(' - File:', f.name, 'ID:', f.id));
      
      // If the deleted file was selected, clear selection
      if (selectedMalwareId === fileId) {
        console.log('Clearing selected file');
        selectMalwareFile(null);
      }
      
      // Show success message
      setToast({
        visible: true,
        message: `File "${fileToDelete.name}" deleted successfully.`,
        type: 'success'
      });
      
      // Force a re-render
      setLoading(true);
      setTimeout(() => setLoading(false), 100);
    } catch (error) {
      console.error('Error deleting file:', error);
      setToast({
        visible: true,
        message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };
  
  // Check if running on web for drag-drop support
  const isWeb = typeof document !== 'undefined';

  return (
    <>
      <View 
        style={[
          styles.container,
          isWeb && isDragging && styles.containerDragging
        ]}
        {...(isWeb ? {
          onDragEnter: handleDragEnter,
          onDragLeave: handleDragLeave,
          onDragOver: handleDragOver,
          onDrop: handleDrop
        } as any : {})}
      >
      <View style={styles.header}>
        <View style={{ flex: 1 }}></View>
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            size="small"
            onPress={handleFileUpload}
            style={styles.uploadButton}
            disabled={loading}
          >
            <View style={styles.uploadButtonContent}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol name="arrow.up.doc" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.buttonText}>Upload</ThemedText>
                </>
              )}
            </View>
          </Button>
        </View>
      </View>
      
      {loading && uploadProgress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${uploadProgress}%` }
              ]} 
            />
          </View>
          <ThemedText style={styles.progressText}>{Math.round(uploadProgress)}%</ThemedText>
        </View>
      )}
      
      {error && (
        <Card variant="outlined" style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <IconSymbol name="exclamationmark.triangle" size={16} color="#FF6B6B" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        </Card>
      )}
      
      {isWeb && isDragging && (
        <View style={styles.dragOverlay}>
          <View style={styles.dragOverlayContent}>
            <IconSymbol name="arrow.down.circle" size={48} color="#4A90E2" />
            <ThemedText style={styles.dragOverlayText}>Drop file here to upload</ThemedText>
          </View>
        </View>
      )}
      
      <ThemedView style={styles.fileListContainer}>
        {malwareFiles.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <AiFillAliwangwang size={32} color="#AAAAAA" />
            <ThemedText style={styles.emptyText}>
              No files yet. Upload a file to get started.
            </ThemedText>
          </ThemedView>
        ) : (
          malwareFiles.map(file => (
            <Card
              key={file.id}
              variant={selectedMalwareId === file.id ? "filled" : "outlined"}
              style={[
                styles.fileItem,
                selectedMalwareId === file.id && styles.selectedFileItem,
              ]}
            >
              <TouchableOpacity
                onPress={() => handleFileSelect(file)}
                style={styles.fileItemContent}
              >
                <View style={styles.fileIconContainer}>
                  <IconSymbol
                    name={file.type.includes('text') ? 'doc.text' : 'doc'}
                    size={24}
                    color={selectedMalwareId === file.id ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text}
                  />
                </View>
                <View style={styles.fileInfo}>
                  <ThemedText
                    style={[
                      styles.fileName,
                      selectedMalwareId === file.id && styles.selectedFileText,
                    ]}
                  >
                    {truncateString(file.name, 20)}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.fileSize,
                      selectedMalwareId === file.id && styles.selectedFileText,
                    ]}
                  >
                    {formatFileSize(file.size)}
                  </ThemedText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleFileDelete(file.id)}
              >
                <FaTrash
                  size={18}
                  color={selectedMalwareId === file.id ? '#FFFFFF' : '#FF6B6B'}
                />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ThemedView>
    </View>
    
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      onDismiss={() => setToast({ ...toast, visible: false })}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#ffd1dd',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fileListContainer: {
    maxHeight: 300,
  },
  fileItem: {
    marginBottom: 8,
  },
  selectedFileItem: {
    borderColor: '#4A90E2',
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000', // Black color for unselected files
  },
  fileSize: {
    fontSize: 14,
    opacity: 0.7,
    color: '#000000', // Black color for unselected files
  },
  selectedFileText: {
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    marginBottom: 10,
    borderColor: '#FF6B6B',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6B6B',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#AAAAAA',
  },
  progressContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
  },
  containerDragging: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dragOverlayContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dragOverlayText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
});
