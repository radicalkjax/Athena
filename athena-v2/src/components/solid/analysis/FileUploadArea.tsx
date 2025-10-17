import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import { memoryManager } from '../../../services/memoryManager';
import { StatCard } from '../shared/StatCard';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invokeCommand, openFileDialog, isTauri } from '../../../utils/tauriCompat';
import { logger } from '../../../services/loggingService';

interface FileMetadata {
  name: string;
  size: number;
  mime_type: string;
  hash: string;
}

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  status: string;
}

export const FileUploadArea: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [uploadedFile, setUploadedFile] = createSignal<FileMetadata | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [uploadProgress, setUploadProgress] = createSignal<UploadProgress | null>(null);
  const [, setCurrentFilePath] = createSignal<string>('');
  
  let unlistenProgress: (() => void) | null = null;
  
  onMount(async () => {
    // Listen for upload progress events (only in Tauri)
    if (isTauri()) {
      try {
        // @ts-ignore - Tauri API
        const { listen } = window.__TAURI__.event;
        unlistenProgress = await listen('upload-progress', (event: any) => {
          setUploadProgress(event.payload);
          
          if (event.payload.status === 'completed') {
            setTimeout(() => setUploadProgress(null), 1000);
          }
        });
      } catch (err) {
        console.warn('Tauri event API not available:', err);
      }
    }
  });
  
  onCleanup(() => {
    if (unlistenProgress) {
      unlistenProgress();
    }
  });

  const handleFileSelect = async () => {
    try {
      if (isTauri()) {
        // Tauri file selection
        const selected = await openFileDialog();
        if (selected && typeof selected === 'string') {
          setCurrentFilePath(selected);
          await uploadFile(selected);
        }
      } else {
        // Web file selection
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            await uploadWebFile(file);
          }
        };
        input.click();
      }
    } catch (err) {
      setError(`Failed to select file: ${err}`);
    }
  };

  const uploadWebFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      // Read file as array buffer
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // Calculate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        hash: hash
      };
      
      setUploadedFile(metadata);
      
      // Add to analysis store
      analysisStore.addFile({
        name: metadata.name,
        path: file.name,
        size: metadata.size,
        hash: metadata.hash,
        type: metadata.mime_type,
        fileData: bytes
      });
    } catch (err) {
      setError(`Failed to upload file: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadFile = async (filePath: string) => {
    setIsUploading(true);
    setError(null);
    
    try {
      // Analyze the file using the backend command
      const analysisResult = await invokeCommand('analyze_file', { filePath });
      
      // Extract metadata from analysis result
      const metadata: FileMetadata = {
        name: filePath.split('/').pop() || filePath,
        size: analysisResult.size,
        mime_type: analysisResult.format.mime_type || 'application/octet-stream',
        hash: analysisResult.hashes.sha256
      };
      
      setUploadedFile(metadata);
      
      // Allocate memory for the file
      const fileId = `file_${metadata.hash}`;
      const allocated = memoryManager.allocate(
        fileId,
        metadata.size,
        'file',
        `File: ${metadata.name}`,
        () => {
          logger.debug(`Memory freed for file ${metadata.name}`);
        }
      );
      
      if (!allocated) {
        throw new Error('Insufficient memory to load file');
      }
      
      // Add to analysis store with full analysis results
      analysisStore.addFile({
        name: metadata.name,
        path: filePath,
        size: metadata.size,
        hash: metadata.hash,
        type: metadata.mime_type,
        analysisResult: analysisResult
      });
      
      // Trigger analysis completed event
      window.dispatchEvent(new CustomEvent('file-analyzed', { 
        detail: { filePath, result: analysisResult } 
      }));
      
      // Start comprehensive analysis via coordinator
      try {
        const { analysisCoordinator } = await import('../../../services/analysisCoordinator');
        const currentFile = analysisStore.state.files.find(f => f.hash === metadata.hash);
        if (currentFile) {
          analysisCoordinator.analyzeFile(currentFile);
        }
      } catch (err) {
        logger.warn('Analysis coordinator not available:', err);
      }
    } catch (err) {
      setError(`Failed to analyze file: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file) return;

      if (isTauri()) {
        // In Tauri, we need to convert the File object to a path
        // For security reasons, Tauri doesn't allow direct file access from drag-drop
        // Instead, we'll read the file and pass it through the same analysis pipeline
        try {
          const buffer = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));

          // Create a temporary file path in Tauri's app data directory
          const fileName = file.name;
          const tempPath = await invokeCommand('create_temp_file', {
            fileName,
            bytes
          });

          if (tempPath) {
            await uploadFile(tempPath);
          } else {
            // If temp file creation fails, fall back to web-style upload
            await uploadWebFile(file);
          }
        } catch (err) {
          logger.warn('Failed to handle Tauri file drop, falling back to web method', err);
          await uploadWebFile(file);
        }
      } else {
        // Web drag and drop
        await uploadWebFile(file);
      }
    }
  };

  return (
    <div class="content-panel" style="padding: 40px; background: transparent;">
      <h2 style="color: var(--barbie-pink); margin-bottom: 30px; font-size: 1.5rem; font-weight: 500;">
        📤 Upload Malware Sample
      </h2>
      
      <div
        class={`upload-area ${isDragging() ? 'dragging' : ''}`}
        onClick={handleFileSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabindex="0"
        aria-label="Click to select file or drag and drop"
      >
        <div class="upload-icon" aria-hidden="true">📤</div>
        <h3>Upload Malware Sample for Analysis</h3>
        <p style="color: var(--text-secondary); margin: 15px 0;">
          Drag and drop files here or click to browse<br/>
          Supports: PE, ELF, Mach-O, Office docs, PDFs, APKs, Archives<br/>
          Maximum file size: 100MB per file
        </p>
        <button class="btn btn-primary">Choose Files</button>
      </div>

      <Show when={error()}>
        <div class="error-message" style="color: var(--danger-color); margin-top: 10px;">
          {error()}
        </div>
      </Show>

      <Show when={isUploading()}>
        <div class="upload-progress" style="margin-top: 20px;">
          <p>Uploading file... {uploadProgress()?.percentage.toFixed(1)}%</p>
          <div class="progress-bar" style="width: 100%; height: 6px; background: var(--accent-bg); border-radius: 3px; overflow: hidden; position: relative;">
            <div 
              class="progress-fill" 
              style={`width: ${uploadProgress()?.percentage || 0}%; height: 100%; background: var(--barbie-pink); transition: width 0.3s ease;`}
            ></div>
          </div>
          <Show when={uploadProgress()}>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">
              {(uploadProgress()!.current / 1024 / 1024).toFixed(2)} MB / {(uploadProgress()!.total / 1024 / 1024).toFixed(2)} MB
            </p>
          </Show>
        </div>
      </Show>

      <Show when={uploadedFile()}>
        <div class="file-info" style="margin-top: 20px; padding: 15px; background: var(--panel-bg); border-radius: 8px;">
          <h3>File Information</h3>
          <dl style="display: grid; grid-template-columns: auto 1fr; gap: 8px; margin-top: 10px;">
            <dt style="color: var(--text-secondary);">Name:</dt>
            <dd>{uploadedFile()!.name}</dd>
            
            <dt style="color: var(--text-secondary);">Size:</dt>
            <dd>{(uploadedFile()!.size / 1024 / 1024).toFixed(2)} MB</dd>
            
            <dt style="color: var(--text-secondary);">Type:</dt>
            <dd>{uploadedFile()!.mime_type}</dd>
            
            <dt style="color: var(--text-secondary);">SHA-256:</dt>
            <dd style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
              {uploadedFile()!.hash}
            </dd>
          </dl>
        </div>
      </Show>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
        <AnalysisPanel title="Analysis Configuration" icon="⚙️">
          <div style="padding: 20px;">
            <h4 style="margin: 0 0 15px 0; font-size: 0.9rem; color: var(--text-primary);">Analysis Types</h4>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" checked style="accent-color: var(--barbie-pink);" />
                <span style="color: var(--text-primary);">Static Analysis (File properties, hashes, entropy)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" checked style="accent-color: var(--barbie-pink);" />
                <span style="color: var(--text-primary);">Dynamic Analysis (CAPE Sandbox)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" checked style="accent-color: var(--barbie-pink);" />
                <span style="color: var(--text-primary);">AI Provider Ensemble (All 6 Models)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" style="accent-color: var(--barbie-pink);" />
                <span style="color: var(--text-primary);">Advanced Reverse Engineering</span>
              </label>
            </div>
            
            <h4 style="margin: 20px 0 15px 0; font-size: 0.9rem; color: var(--text-primary);">Sandbox Environment</h4>
            <div style="margin-bottom: 15px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Operating System Family:</label>
              <select style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                <option>Windows</option>
                <option>Linux</option>
                <option>macOS</option>
              </select>
            </div>
            
            <div style="margin-bottom: 15px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Architecture:</label>
              <select style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                <option>x86-64</option>
                <option>x86</option>
                <option>ARM64</option>
              </select>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Version:</label>
              <select style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                <option>Windows 11 23H2 (Latest)</option>
                <option>Windows 10 22H2</option>
                <option>Windows Server 2022</option>
              </select>
            </div>
            
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" checked style="accent-color: var(--barbie-pink);" />
                <span style="color: var(--info-color); font-size: 0.85rem;">Windows 11 23H2 (Latest) (x86-64)</span>
              </label>
            </div>
          </div>
        </AnalysisPanel>
        
        <AnalysisPanel title="Quick Stats" icon="📊">
          <div class="stats-overview" style="grid-template-columns: 1fr; padding: 20px;">
            <StatCard value="2,847" label="Samples Analyzed Today" />
            <StatCard value="94.3%" label="AI Provider Accuracy" />
            <StatCard value="1.2s" label="Avg Analysis Time" />
          </div>
        </AnalysisPanel>
      </div>
    </div>
  );
};