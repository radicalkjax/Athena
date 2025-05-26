import { AIModel } from '@/types';
import { AIModelSliceCreator } from '../types';

export const createAIModelSlice: AIModelSliceCreator = (set) => ({
  aiModels: [],
  selectedModelId: null,
  
  setAIModels: (models: AIModel[]) => 
    set({ aiModels: models }),
  
  selectAIModel: (id: string | null) => 
    set({ selectedModelId: id }),
});