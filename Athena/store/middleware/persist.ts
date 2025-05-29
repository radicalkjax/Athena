import { StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from '../types';

// Define which parts of the state should be persisted
// IMPORTANT: We exclude sensitive data like malware files and API keys
interface PersistedState {
  // AI Models - persist only non-sensitive data
  selectedModelId: string | null;
  
  // Analysis - persist results but not the actual malware content
  analysisResults: Array<{
    id: string;
    malwareId: string;
    modelId: string;
    timestamp: number;
    // Exclude deobfuscatedCode and analysisReport for security
    vulnerabilities?: AppState['analysisResults'][0]['vulnerabilities'];
    error?: string;
  }>;
  selectedResultId: string | null;
  
  // Container - persist basic info only
  containers: Array<{
    id: string;
    status: AppState['containers'][0]['status'];
    malwareId: string;
    createdAt: number;
    os?: AppState['containers'][0]['os'];
    architecture?: AppState['containers'][0]['architecture'];
  }>;
}

// Storage adapter that works for both web and mobile
const storage = createJSONStorage(() => {
  // Use AsyncStorage for React Native
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage;
  }
  return AsyncStorage;
});

// Custom partialize function to control what gets persisted
const partialize = (state: AppState): PersistedState => ({
  selectedModelId: state.selectedModelId,
  analysisResults: (state.analysisResults || []).map(result => ({
    id: result.id,
    malwareId: result.malwareId,
    modelId: result.modelId,
    timestamp: result.timestamp,
    vulnerabilities: result.vulnerabilities,
    error: result.error,
  })),
  selectedResultId: state.selectedResultId,
  containers: (state.containers || []).map(container => ({
    id: container.id,
    status: container.status,
    malwareId: container.malwareId,
    createdAt: container.createdAt,
    os: container.os,
    architecture: container.architecture,
  })),
});

export const persistConfig = {
  name: 'athena-storage',
  storage,
  partialize,
  version: 1,
  migrate: (persistedState: any, version: number) => {
    // Handle future migrations here
    return persistedState;
  },
};

export const createPersistMiddleware = <T extends AppState>(
  f: StateCreator<T, [], []>
) => persist(f, persistConfig as any);