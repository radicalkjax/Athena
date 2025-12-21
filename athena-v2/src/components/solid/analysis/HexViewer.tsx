import { Component, createSignal, Show } from 'solid-js';
import HexEditor from '../editors/HexEditor';
import { invokeCommand } from '../../../utils/tauriCompat';
import AnalysisPanel from '../shared/AnalysisPanel';

interface HexViewerProps {
  filePath?: string;
}

const HexViewer: Component<HexViewerProps> = (props) => {
  const [fileData, setFileData] = createSignal<Uint8Array | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const loadFile = async () => {
    if (!props.filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Read file as binary through Tauri
      const result = await invokeCommand('read_file_binary', {
        path: props.filePath,
        offset: 0,
        length: 1024 * 1024 // Read first 1MB
      }) as number[];

      setFileData(new Uint8Array(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (offset: number, value: number) => {
    const data = fileData();
    if (!data) return;
    
    const newData = new Uint8Array(data);
    newData[offset] = value;
    setFileData(newData);
    
    // Optionally save changes back to file
    // invoke('write_file_binary', { path: props.filePath, data: Array.from(newData) });
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🔍 Hex Viewer & Editor
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Binary Analysis" 
            icon="📝"
            className="scrollable-panel"
            actions={
          <div style="display: flex; gap: 10px;">
            <button 
              class="btn btn-primary"
              onClick={loadFile}
              disabled={!props.filePath || loading()}
            >
              {loading() ? '⏳ Loading...' : '📂 Load File'}
            </button>
            <button class="btn btn-secondary">
              💾 Save Changes
            </button>
          </div>
        }
      >
        <Show when={error()}>
          <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid var(--danger-color); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: var(--danger-color);">⚠️ Error:</strong> {error()}
          </div>
        </Show>
        
        <Show when={fileData()}>
          <div style="background: var(--bg-secondary); border-radius: 8px; padding: 20px; overflow: auto;">
            <HexEditor 
              data={fileData()!}
              onDataChange={handleDataChange}
              readOnly={false}
            />
          </div>
        </Show>
        
        <Show when={!fileData() && !error() && !loading()}>
          <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
            <div style="font-size: 3rem; margin-bottom: 20px;">📄</div>
            <p style="font-size: 1.1rem;">Click "Load File" to view the hex representation</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">Supports viewing and editing binary files up to 1MB</p>
          </div>
        </Show>
          </AnalysisPanel>
        </div>
        
        <div>
          <AnalysisPanel title="File Information" icon="ℹ️">
            <div class="info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <strong>File Path:</strong>
                <div style="color: var(--text-secondary);">{props.filePath || 'No file selected'}</div>
              </div>
              <div>
                <strong>Size Loaded:</strong>
                <div style="color: var(--text-secondary);">
                  {fileData() ? `${fileData()!.length.toLocaleString()} bytes` : 'N/A'}
                </div>
              </div>
              <div>
                <strong>Offset:</strong>
                <div style="color: var(--text-secondary);">0x00000000</div>
              </div>
              <div>
                <strong>Encoding:</strong>
                <div style="color: var(--text-secondary);">UTF-8 / ASCII</div>
              </div>
            </div>
          </AnalysisPanel>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            🛠️ Hex Tools
          </h3>
          
          <div class="artifacts-grid">
            <button class="btn btn-secondary">🔍 Search</button>
            <button class="btn btn-secondary">📋 Copy Selection</button>
            <button class="btn btn-secondary">↩️ Undo</button>
            <button class="btn btn-secondary">↪️ Redo</button>
            <button class="btn btn-primary">🎯 Go to Offset</button>
            <button class="btn btn-primary">📊 Statistics</button>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
            <h4 style="margin-bottom: 10px;">Quick Actions</h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="padding: 5px 0;">• Press Ctrl+F to search</li>
              <li style="padding: 5px 0;">• Click bytes to edit</li>
              <li style="padding: 5px 0;">• Drag to select range</li>
              <li style="padding: 5px 0;">• Right-click for context menu</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default HexViewer;