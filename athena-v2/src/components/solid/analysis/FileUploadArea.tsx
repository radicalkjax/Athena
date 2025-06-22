import { Component, createSignal, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface FileMetadata {
  name: string;
  size: number;
  mime_type: string;
  hash: string;
}

export const FileUploadArea: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [uploadedFile, setUploadedFile] = createSignal<FileMetadata | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });

      if (selected && typeof selected === 'string') {
        await uploadFile(selected);
      }
    } catch (err) {
      setError(`Failed to select file: ${err}`);
    }
  };

  const uploadFile = async (filePath: string) => {
    setIsUploading(true);
    setError(null);
    
    try {
      const metadata = await invoke<FileMetadata>('upload_file', { path: filePath });
      setUploadedFile(metadata);
    } catch (err) {
      setError(`Failed to upload file: ${err}`);
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
      // In Tauri, we need to handle file drops differently
      // This is a placeholder - actual implementation would need native file handling
      setError('Drag and drop not yet implemented. Please use the file selector.');
    }
  };

  return (
    <div class="upload-section">
      <h2>Upload File for Analysis</h2>
      
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
        <div class="upload-icon">📁</div>
        <p>Click to select file or drag and drop</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
          Supported: EXE, DLL, PDF, DOC, ZIP, and more
        </p>
      </div>

      <Show when={error()}>
        <div class="error-message" style="color: var(--danger-color); margin-top: 10px;">
          {error()}
        </div>
      </Show>

      <Show when={isUploading()}>
        <div class="upload-progress" style="margin-top: 20px;">
          <p>Uploading file...</p>
          <div class="progress-bar" style="width: 100%; height: 4px; background: var(--accent-bg); border-radius: 2px; overflow: hidden;">
            <div class="progress-fill" style="width: 50%; height: 100%; background: var(--barbie-pink); animation: loading 1s ease-in-out infinite;"></div>
          </div>
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
          
          <button
            class="analyze-button"
            style="margin-top: 15px; padding: 10px 20px; background: var(--barbie-pink); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"
            onClick={() => console.log('Starting analysis...')}
          >
            Start Analysis
          </button>
        </div>
      </Show>
    </div>
  );
};