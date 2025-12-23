import { Component, createSignal, onMount, onCleanup, Show, lazy, Suspense } from 'solid-js';
import { Header } from './components/solid/layout/Header';
import { Sidebar } from './components/solid/navigation/Sidebar';
import { FileUploadArea } from './components/solid/analysis/FileUploadArea';
import { ErrorBoundary, AnalysisErrorBoundary, WasmErrorBoundary } from './components/solid/ErrorBoundary';
import { analysisStore } from './stores/analysisStore';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { useKeyboardShortcuts } from './services/keyboardShortcuts';
import { LoadingOverlay, LoadingSpinner } from './components/solid/shared/LoadingStates';

// Lazy load heavy analysis components
const StaticAnalysis = lazy(() => import('./components/solid/analysis/StaticAnalysis'));
const DynamicAnalysis = lazy(() => import('./components/solid/analysis/DynamicAnalysis'));
const AIEnsemble = lazy(() => import('./components/solid/analysis/AIEnsemble'));
const Reports = lazy(() => import('./components/solid/analysis/Reports'));
const HexViewer = lazy(() => import('./components/solid/analysis/HexViewer'));
const NetworkAnalysis = lazy(() => import('./components/solid/analysis/NetworkAnalysis'));
const Disassembly = lazy(() => import('./components/solid/analysis/Disassembly'));
const YaraScanner = lazy(() => import('./components/solid/analysis/YaraScanner'));
const ThreatIntelligence = lazy(() => import('./components/solid/analysis/ThreatIntelligence'));
const MemoryAnalysis = lazy(() => import('./components/solid/analysis/MemoryAnalysis'));
const CustomWorkflows = lazy(() => import('./components/solid/analysis/CustomWorkflows'));
const PlatformConfig = lazy(() => import('./components/solid/PlatformConfig'));
const ContainerSandbox = lazy(() => import('./components/solid/analysis/ContainerSandbox'));

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
              <AnalysisErrorBoundary>
                <FileUploadArea />
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'static' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <StaticAnalysis />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'dynamic' ? 'active' : ''}`}>
              <WasmErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <DynamicAnalysis />
                </Suspense>
              </WasmErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'ai-ensemble' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <AIEnsemble />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'threat-intel' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <ThreatIntelligence />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'reports' ? 'active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                <Reports />
              </Suspense>
            </div>
            <div class={`content-panel-container ${activePanel() === 'hex' ? 'active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                <HexViewer filePath={analysisStore.state.uploadedFile?.path} />
              </Suspense>
            </div>
            <div class={`content-panel-container ${activePanel() === 'network' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <NetworkAnalysis filePath={analysisStore.state.uploadedFile?.path} />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'disassembly' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <Disassembly filePath={analysisStore.state.uploadedFile?.path} />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'memory' ? 'active' : ''}`}>
              <WasmErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <MemoryAnalysis />
                </Suspense>
              </WasmErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'container' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <ContainerSandbox />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'workflows' ? 'active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                <CustomWorkflows />
              </Suspense>
            </div>
            <div class={`content-panel-container ${activePanel() === 'yara' ? 'active' : ''}`}>
              <AnalysisErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <YaraScanner />
                </Suspense>
              </AnalysisErrorBoundary>
            </div>
            <div class={`content-panel-container ${activePanel() === 'platform-config' ? 'active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                <PlatformConfig />
              </Suspense>
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