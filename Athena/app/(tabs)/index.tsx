import React, { useState, useEffect } from 'react';
import { Text, View, Image, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { AIModelSelector } from '@/components/AIModelSelector';
import { FileUploader } from '@/components/FileUploader';
import { AnalysisResults } from '@/components/AnalysisResults';
import { AIModel, MalwareFile, AnalysisResult } from '@/types';
import { useAppStore } from '@/store';
import * as analysisService from '@/services/analysisService';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { AiOutlineCodepenCircle } from "react-icons/ai";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [selectedFile, setSelectedFile] = useState<MalwareFile | null>(null);
  const [useContainer, setUseContainer] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const { isAnalyzing, setIsAnalyzing, analysisResults, selectedResultId, selectAnalysisResult } = useAppStore(state => ({
    isAnalyzing: state.isAnalyzing,
    setIsAnalyzing: state.setIsAnalyzing,
    analysisResults: state.analysisResults,
    selectedResultId: state.selectedResultId,
    selectAnalysisResult: state.selectAnalysisResult,
  }));
  
  useEffect(() => {
    // If a result is already selected, load it
    if (selectedResultId) {
      const result = analysisResults.find(r => r.id === selectedResultId);
      if (result) {
        setAnalysisResult(result);
      }
    }
  }, [selectedResultId, analysisResults]);
  
  const handleModelSelect = (model: AIModel) => {
    setSelectedModel(model);
  };
  
  const handleFileSelect = (file: MalwareFile) => {
    setSelectedFile(file);
    
    // Check if there's an existing analysis result for this file
    const existingResult = analysisResults.find(r => r.malwareId === file.id);
    if (existingResult) {
      setAnalysisResult(existingResult);
      selectAnalysisResult(existingResult.id);
    } else {
      setAnalysisResult(null);
      selectAnalysisResult(null);
    }
  };
  
  const handleAnalyze = async () => {
    if (!selectedModel) {
      Alert.alert('Error', 'Please select an AI model.');
      return;
    }
    
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file to analyze.');
      return;
    }
    
    try {
      // Start analysis
      setIsAnalyzing(true);
      
      // Run analysis
      const result = await analysisService.runAnalysis(
        selectedFile,
        selectedModel,
        useContainer
      );
      
      // Set result
      setAnalysisResult(result);
      selectAnalysisResult(result.id);
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis Error', `Failed to analyze file: ${(error as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e47a9c', dark: '#d06c86' }}
      headerImage={
        <View style={styles.logoContainer}>
          <Image
            source={require('./../../assets/images/real-athena-logo.png')}
            style={[styles.reactLogo, styles.roundedImage]}
            resizeMode="contain"
          />
        </View>
      }
      title="Athena Malware Analysis">
      <View style={styles.titleContainer}>
        <ThemedText type="title"
          style={styles.titleText}
        >
          Athena Malware Analysis</ThemedText>
      </View>
      
      <ThemedText style={styles.description}>
        Analyze and deobfuscate malware using AI models. Select a file and an AI model, then click "Analyze" to start.
      </ThemedText>
      
      <ScrollView style={styles.contentContainer}>
        <View style={styles.sectionContainer}>
          <AIModelSelector onModelSelect={handleModelSelect} />
        </View>
        
        <View style={styles.sectionContainer}>
        <ThemedText style={styles.optionsTitle}>Uploaded Files</ThemedText>
          <FileUploader onFileSelect={handleFileSelect} />
        </View>
        
        <View style={styles.optionsContainer}>
          <ThemedText style={styles.optionsTitle}>Analysis Options</ThemedText>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => setUseContainer(!useContainer)}
          >
            <AiOutlineCodepenCircle
              size={24}
              color={Colors[colorScheme ?? 'light'].tint}
            />
            <View style={styles.optionTextContainer}>
              <ThemedText style={styles.optionText}>Use Container</ThemedText>
              <ThemedText style={styles.optionDescription}>
                Run malware in an isolated container for safer analysis
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[
            styles.analyzeButton,
            (isAnalyzing || !selectedModel || !selectedFile) && styles.disabledButton,
          ]}
          onPress={handleAnalyze}
          disabled={isAnalyzing || !selectedModel || !selectedFile}
        >
          <ThemedText style={styles.analyzeButtonText}>
            {isAnalyzing ? 'Analyzing...' : 'Waiting To Analyze Malware'}
          </ThemedText>
        </TouchableOpacity>
        
        <View style={styles.resultsContainer}>
          <AnalysisResults result={analysisResult} isAnalyzing={isAnalyzing} />
        </View>
      </ScrollView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    backgroundColor: '#d76e8b',
    justifyContent: 'center',
    alignItems: 'center',
    height: 250,
    width: '100%',
  },
  reactLogo: {
    height: 200,
    width: 300,
    alignSelf: 'center',
  },
  roundedImage: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Roboto-Bold',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffd1dd',
    borderRadius: 8,
  },
  optionTextContainer: {
    marginLeft: 10,
  },
  optionText: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  optionDescription: {
    fontSize: 14,
    color: '#000',
    opacity: 0.7,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d06c86',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#AAAAAA',
    opacity: 0.7,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  resultsContainer: {
    marginBottom: 18,
  },
});
