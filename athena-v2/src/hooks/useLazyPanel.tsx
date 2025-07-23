import { createSignal, createMemo } from 'solid-js';

export function useLazyPanel(activePanel: () => string) {
  const [loadedPanels, setLoadedPanels] = createSignal<Set<string>>(new Set(['upload']));
  
  // Track which panels have been visited
  const shouldLoad = (panelName: string) => {
    const current = activePanel();
    const loaded = loadedPanels();
    
    if (current === panelName && !loaded.has(panelName)) {
      setLoadedPanels(new Set([...loaded, panelName]));
      return true;
    }
    
    return loaded.has(panelName);
  };
  
  return { shouldLoad };
}