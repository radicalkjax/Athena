import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

interface FileUploaderProps {
  onFileSelect: (file: MalwareFile) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      setLoading(true);
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
        const filePromise = new Promise<MalwareFile | null>((resolve) => {
          input.onchange = async (e) => {
            const target = e.target as HTMLInputElement;
            const files = target.files;
            
            if (files && files.length > 0) {
              const selectedFile = files[0];
              console.log('Selected file:', selectedFile.name, 'Size:', selectedFile.size, 'Type:', selectedFile.type);
              
              // Read file content for small text files
              let content = '';
              if (
                selectedFile.size < 1024 * 1024 && // Less than 1MB
                (selectedFile.type.includes('text') || 
                 selectedFile.type.includes('javascript') || 
                 selectedFile.type.includes('json') || 
                 selectedFile.type.includes('xml') || 
                 selectedFile.type.includes('html') || 
                 selectedFile.type.includes('css') ||
                 selectedFile.name.endsWith('.js') ||
                 selectedFile.name.endsWith('.py') ||
                 selectedFile.name.endsWith('.php') ||
                 selectedFile.name.endsWith('.java') ||
                 selectedFile.name.endsWith('.c') ||
                 selectedFile.name.endsWith('.cpp') ||
                 selectedFile.name.endsWith('.cs') ||
                 selectedFile.name.endsWith('.go') ||
                 selectedFile.name.endsWith('.rb') ||
                 selectedFile.name.endsWith('.pl') ||
                 selectedFile.name.endsWith('.sh'))
              ) {
                const reader = new FileReader();
                content = await new Promise<string>((resolve) => {
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsText(selectedFile);
                });
              }
              
              // Create a MalwareFile object
              const fileId = Math.random().toString(36).substring(2, 15);
              const malwareFile: MalwareFile = {
                id: fileId,
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                uri: URL.createObjectURL(selectedFile), // Create a blob URL
                content,
              };
              
              resolve(malwareFile);
            } else {
              resolve(null);
            }
          };
          
          // Trigger the file dialog
          input.click();
        });
        
        // Wait for file selection
        const file = await filePromise;
        console.log('File selection result:', file ? 'File selected' : 'No file selected');
        
        if (file) {
          // Add file to store
          addMalwareFile(file);
          console.log('File added to store');
          
          // Select the file
          selectMalwareFile(file.id);
          onFileSelect(file);
          console.log('File selected for analysis');
          
          // Show success message
          Alert.alert('Success', `File "${file.name}" uploaded successfully.`);
        } else {
          console.log('No file was selected or the picker was cancelled');
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
          console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
          
          // Add file to store
          addMalwareFile(file);
          console.log('File added to store');
          
          // Select the file
          selectMalwareFile(file.id);
          onFileSelect(file);
          console.log('File selected for analysis');
          
          // Show success message
          Alert.alert('Success', `File "${file.name}" uploaded successfully.`);
        } else {
          console.log('No file was selected or the picker was cancelled');
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to upload file: ${errorMessage}`);
      Alert.alert('Error', `Failed to upload file: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileSelect = (file: MalwareFile) => {
    selectMalwareFile(file.id);
    onFileSelect(file);
  };
  
  const handleFileDelete = async (fileId: string) => {
    console.log('Delete button clicked for file ID:', fileId);
    
    try {
      // Check if the file exists in the store
      const fileToDelete = malwareFiles.find(f => f.id === fileId);
      if (!fileToDelete) {
        console.error('File not found in store:', fileId);
        Alert.alert('Error', 'File not found.');
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
      Alert.alert('Success', `File "${fileToDelete.name}" deleted successfully.`);
      
      // Force a re-render
      setLoading(true);
      setTimeout(() => setLoading(false), 100);
    } catch (error) {
      console.error('Error deleting file:', error);
      Alert.alert('Error', `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  
  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <ThemedText style={styles.loadingText}>Loading files...</ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}></View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.uploadButton]}
            onPress={handleFileUpload}
          >
            <IconSymbol name="arrow.up.doc" size={16} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Upload</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
      
      {error && (
        <ThemedView style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={16} color="#FF6B6B" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
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
            <TouchableOpacity
              key={file.id}
              style={[
                styles.fileItem,
                selectedMalwareId === file.id && styles.selectedFileItem,
              ]}
              onPress={() => handleFileSelect(file)}
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
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleFileDelete(file.id)}
              >
                <FaTrash
                  size={18}
                  color={selectedMalwareId === file.id ? '#FFFFFF' : '#FF6B6B'}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ThemedView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 8,
    padding: 10,
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
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  fileListContainer: {
    maxHeight: 300,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  selectedFileItem: {
    backgroundColor: '#4A90E2',
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF0F0',
    borderRadius: 4,
    marginBottom: 10,
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
});
