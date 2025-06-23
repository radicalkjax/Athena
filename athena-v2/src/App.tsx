import { Component, createSignal } from 'solid-js';
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

const App: Component = () => {
  const [activePanel, setActivePanel] = createSignal('upload');

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
};

export default App;