import { Container } from '@/types';
import { ContainerSliceCreator } from '../types';

export const createContainerSlice: ContainerSliceCreator = (set) => ({
  containers: [],
  
  addContainer: (container: Container) => 
    set((state) => ({ 
      containers: [...state.containers, container] 
    })),
  
  updateContainer: (id: string, updates: Partial<Container>) => 
    set((state) => ({
      containers: state.containers.map(container => 
        container.id === id ? { ...container, ...updates } : container
      )
    })),
  
  removeContainer: (id: string) => 
    set((state) => ({
      containers: state.containers.filter(container => container.id !== id)
    })),
});