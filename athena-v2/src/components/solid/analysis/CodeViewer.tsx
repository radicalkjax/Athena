import { Component, createSignal, Show } from 'solid-js';
import CodeEditor from '../editors/CodeEditor';
import { invoke } from '@tauri-apps/api/core';
import AnalysisPanel from '../shared/AnalysisPanel';

interface CodeViewerProps {
  filePath?: string;
}

const CodeViewer: Component<CodeViewerProps> = (props) => {
  const [code, setCode] = createSignal('');
  const [language, setLanguage] = createSignal('javascript');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const detectLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'sh': 'bash',
      'ps1': 'powershell',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
    };
    
    return languageMap[ext || ''] || 'text';
  };

  const loadFile = async () => {
    if (!props.filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Read file as text through Tauri
      const result = await invoke<string>('read_file_text', {
        path: props.filePath
      });
      
      setCode(result);
      setLanguage(detectLanguage(props.filePath));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    // Optionally save changes back to file
    // invoke('write_file_text', { path: props.filePath, content: newCode });
  };

  return (
    <div class="content-panel">
      <div class="panel-header">
        <h3><span style="color: var(--barbie-pink)">📄</span> Code Viewer</h3>
        <div class="code-viewer-controls">
          <button 
            class={loading() ? "btn-secondary" : "btn-primary"}
            onClick={loadFile}
            disabled={!props.filePath || loading()}
          >
            {loading() ? 'Loading...' : 'Load File'}
          </button>
        </div>
      </div>
      
      <Show when={error()}>
        <div class="code-viewer-error">
          Error: {error()}
        </div>
      </Show>
      
      <Show when={code()}>
        <AnalysisPanel title="Code Editor" icon="💻">
          <div class="code-editor-wrapper">
            <CodeEditor 
              code={code()}
              language={language()}
              onChange={handleCodeChange}
              readOnly={false}
              theme="dark"
            />
          </div>
        </AnalysisPanel>
      </Show>
      
      <Show when={!code() && !error() && !loading()}>
        <div class="code-viewer-placeholder">
          <p>Click "Load File" to view and edit the code</p>
        </div>
      </Show>
    </div>
  );
};

export default CodeViewer;