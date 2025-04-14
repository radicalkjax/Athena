import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { MalwareFile } from '@/types';
import { useAppStore } from '@/store';
import * as fileManagerService from '@/services/fileManager';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { formatFileSize, truncateString } from '@/utils/helpers';

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
      
      const file = await fileManagerService.pickFile();
      
      if (file) {
        // Add file to store
        addMalwareFile(file);
        
        // Select the file
        selectMalwareFile(file.id);
        onFileSelect(file);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileSelect = (file: MalwareFile) => {
    selectMalwareFile(file.id);
    onFileSelect(file);
  };
  
  const handleFileDelete = (fileId: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to delete this file?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const file = malwareFiles.find(f => f.id === fileId);
              
              if (file) {
                // Delete file from file system
                await fileManagerService.deleteFile(file.uri);
                
                // Remove file from store
                removeMalwareFile(fileId);
                
                // If the deleted file was selected, clear selection
                if (selectedMalwareId === fileId) {
                  selectMalwareFile(null);
                }
              }
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  const handleCreateTextFile = () => {
    Alert.prompt(
      'Create Text File',
      'Enter file name:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Create',
          onPress: async (fileName?: string) => {
            if (fileName) {
              try {
                setLoading(true);
                
                // Create empty text file
                const file = await fileManagerService.createTextFile(
                  fileName.endsWith('.txt') ? fileName : `${fileName}.txt`,
                  ''
                );
                
                // Add file to store
                addMalwareFile(file);
                
                // Select the file
                selectMalwareFile(file.id);
                onFileSelect(file);
              } catch (error) {
                console.error('Error creating text file:', error);
                Alert.alert('Error', 'Failed to create text file.');
              } finally {
                setLoading(false);
              }
            }
          },
        },
      ],
      'plain-text'
    );
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
        <ThemedText style={styles.title}>Malware Files</ThemedText>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreateTextFile}
          >
            <IconSymbol name="doc.badge.plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>New</ThemedText>
          </TouchableOpacity>
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
            <IconSymbol name="doc.text" size={32} color="#AAAAAA" />
            <ThemedText style={styles.emptyText}>
              No files yet. Upload a file or create a new one.
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
                <IconSymbol
                  name="trash"
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
  },
  fileSize: {
    fontSize: 14,
    opacity: 0.7,
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
