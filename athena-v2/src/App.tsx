import { Component, createSignal } from 'solid-js';
import { Header } from './components/solid/layout/Header';
import { Sidebar } from './components/solid/navigation/Sidebar';
import { FileUploadArea } from './components/solid/analysis/FileUploadArea';
import { AIProviderStatus } from './components/solid/providers/AIProviderStatus';
import { analysisStore } from './stores/analysisStore';

const App: Component = () => {
  const [activePanel, setActivePanel] = createSignal('upload');

  return (
    <div class="app-container">
      <Header />
      <div class="main-layout">
        <Sidebar activePanel={activePanel()} onPanelChange={setActivePanel} />
        <main id="main-content" class="analysis-area">
          <div class="tab-nav">
            <button
              class={`tab ${activePanel() === 'upload' ? 'active' : ''}`}
              onClick={() => setActivePanel('upload')}
            >
              <span>📁</span> File Upload
            </button>
            <button
              class={`tab ${activePanel() === 'analysis' ? 'active' : ''}`}
              onClick={() => setActivePanel('analysis')}
            >
              <span>🔍</span> Analysis
            </button>
            <button
              class={`tab ${activePanel() === 'reports' ? 'active' : ''}`}
              onClick={() => setActivePanel('reports')}
            >
              <span>📊</span> Reports
            </button>
          </div>
          <div class="content-panels">
            <div class={`content-panel ${activePanel() === 'upload' ? 'active' : ''}`}>
              <FileUploadArea />
            </div>
            <div class={`content-panel ${activePanel() === 'analysis' ? 'active' : ''}`}>
              <h2>Analysis Dashboard</h2>
              <AIProviderStatus />
            </div>
            <div class={`content-panel ${activePanel() === 'reports' ? 'active' : ''}`}>
              <h2>Reports</h2>
              <p>Report generation coming soon...</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;