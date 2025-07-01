import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Header } from './components/solid/layout/Header';
import { Sidebar } from './components/solid/navigation/Sidebar';
import { FileUploadArea } from './components/solid/analysis/FileUploadArea';
import StaticAnalysis from './components/solid/analysis/StaticAnalysis';
import DynamicAnalysis from './components/solid/analysis/DynamicAnalysis';
import AIEnsemble from './components/solid/analysis/AIEnsemble';
import Reports from './components/solid/analysis/Reports';
import HexViewer from './components/solid/analysis/HexViewer';
import NetworkAnalysis from './components/solid/analysis/NetworkAnalysis';
import Disassembly from './components/solid/analysis/Disassembly';
import { ErrorBoundary, AnalysisErrorBoundary } from './components/solid/ErrorBoundary';
import YaraScanner from './components/solid/analysis/YaraScanner';
import ThreatIntelligence from './components/solid/analysis/ThreatIntelligence';
import MemoryAnalysis from './components/solid/analysis/MemoryAnalysis';
import CustomWorkflows from './components/solid/analysis/CustomWorkflows';
import PlatformConfig from './components/solid/PlatformConfig';
import { analysisStore } from './stores/analysisStore';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { useKeyboardShortcuts } from './services/keyboardShortcuts';
import { LoadingOverlay } from './components/solid/shared/LoadingStates';

const App: Component = () => {
  const [activePanel, setActivePanel] = createSignal('upload');
  const [isLoading] = createSignal(false);
  const [globalError, setGlobalError] = createSignal<string | null>(null);
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  onMount(() => {
    // Listen for navigation events from keyboard shortcuts
    const handleNavigate = (e: CustomEvent) => {
      const panelMap: Record<string, string> = {
        'static': 'static',
        'dynamic': 'dynamic',
        'network': 'network',
        'ai': 'ai-ensemble'
      };
      const panel = panelMap[e.detail.tab];
      if (panel) setActivePanel(panel);
    };

    // Listen for global errors
    const handleError = (e: ErrorEvent) => {
      console.error('Global error:', e.error);
      setGlobalError(e.message);
      setTimeout(() => setGlobalError(null), 5000);
    };

    window.addEventListener('navigate-tab', handleNavigate as EventListener);
    window.addEventListener('error', handleError);

    onCleanup(() => {
      window.removeEventListener('navigate-tab', handleNavigate as EventListener);
      window.removeEventListener('error', handleError);
    });
  });

  return (
    <ErrorBoundary>
      <AnalysisProvider>
        <Show when={isLoading()}>
          <LoadingOverlay message="Loading Athena Security Platform..." />
        </Show>
        
        <Show when={globalError()}>
          <div class="global-error-banner">
            <span>⚠️ {globalError()}</span>
            <button onClick={() => setGlobalError(null)}>✕</button>
          </div>
        </Show>
        
        <div class="app-container">
          <Header />
          <div class="main-content">
            <Sidebar activePanel={activePanel()} onPanelChange={setActivePanel} />
            <main class="analysis-area" id="main-content" role="main">
            <div class="content-panels">
            <div class={`content-panel-container ${activePanel() === 'upload' ? 'active' : ''}`}>
              <FileUploadArea />
            </div>
            <div class={`content-panel-container ${activePanel() === 'static' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <StaticAnalysis />
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'dynamic' ? 'active' : ''}`}>
              <DynamicAnalysis />
            </div>
            <div class={`content-panel-container ${activePanel() === 'ai-ensemble' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <AIEnsemble />
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'threat-intel' ? 'active' : ''}`}>
              <ThreatIntelligence />
            </div>
            <div class={`content-panel-container ${activePanel() === 'reports' ? 'active' : ''}`}>
              <Reports />
            </div>
            <div class={`content-panel-container ${activePanel() === 'hex' ? 'active' : ''}`}>
              <HexViewer filePath={analysisStore.state.uploadedFile?.path} />
            </div>
            <div class={`content-panel-container ${activePanel() === 'network' ? 'active' : ''}`}>
              <NetworkAnalysis filePath={analysisStore.state.uploadedFile?.path} />
            </div>
            <div class={`content-panel-container ${activePanel() === 'disassembly' ? 'active' : ''}`}>
              <Disassembly filePath={analysisStore.state.uploadedFile?.path} />
            </div>
            <div class={`content-panel-container ${activePanel() === 'memory' ? 'active' : ''}`}>
              <MemoryAnalysis />
            </div>
            <div class={`content-panel-container ${activePanel() === 'workflows' ? 'active' : ''}`}>
              <CustomWorkflows />
            </div>
            <div class={`content-panel-container ${activePanel() === 'yara' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <YaraScanner />
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'platform-config' ? 'active' : ''}`}>
              <PlatformConfig />
            </div>
          </div>
        </main>
      </div>
    </div>
    </AnalysisProvider>
    </ErrorBoundary>
  );
};

export default App;