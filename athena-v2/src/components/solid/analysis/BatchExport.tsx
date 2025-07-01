import { Component, createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { exportService, ExportOptions } from '../../../services/exportService';
import { analysisStore } from '../../../stores/analysisStore';
import { VirtualList } from '../shared/VirtualList';
import './BatchExport.css';

interface BatchExportProps {
  onClose?: () => void;
}

const BatchExport: Component<BatchExportProps> = (props) => {
  const [selectedFiles, setSelectedFiles] = createStore<Set<string>>(new Set());
  const [exportOptions, setExportOptions] = createStore<ExportOptions>({
    format: 'json',
    includeMetadata: true,
    compression: false,
    encryption: {
      enabled: false
    }
  });
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportProgress, setExportProgress] = createSignal(0);
  const [selectedTemplate, setSelectedTemplate] = createSignal<string>('');
  const [namingOption, setNamingOption] = createSignal<'original' | 'sequential' | 'custom'>('original');
  const [customPattern, setCustomPattern] = createSignal('export_{index}_{timestamp}');
  const [password, setPassword] = createSignal('');
  const [showPassword, setShowPassword] = createSignal(false);

  const templates = exportService.getTemplates();
  const completedAnalyses = () => {
    const allFiles = analysisStore.files();
    return allFiles
      .filter(file => file.status === 'completed')
      .map(file => ({
        fileId: file.id,
        fileName: file.name,
        timestamp: file.uploadedAt,
        resultCount: file.results ? Object.keys(file.results).length : 0
      }));
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const selectAll = () => {
    const allFileIds = completedAnalyses().map(a => a.fileId);
    setSelectedFiles(new Set(allFileIds));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = exportService.getTemplate(templateId);
    if (template) {
      setExportOptions('format', template.format);
    }
  };

  const handleBatchExport = async () => {
    if (selectedFiles.size === 0) {
      alert('Please select at least one file to export');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Prepare analysis data map
      const analysisDataMap = new Map<string, any>();
      const fileIds = Array.from(selectedFiles);
      
      fileIds.forEach((fileId, index) => {
        const file = analysisStore.files().find(f => f.id === fileId);
        if (file?.results) {
          analysisDataMap.set(fileId, file.results);
        }
        setExportProgress(((index + 1) / fileIds.length) * 50);
      });

      // Perform batch export
      const batchOptions = {
        ...exportOptions,
        fileIds,
        naming: namingOption(),
        customNamingPattern: customPattern(),
        template: selectedTemplate(),
        encryption: exportOptions.encryption?.enabled ? {
          enabled: true,
          password: password()
        } : { enabled: false }
      };

      const exportedPaths = await exportService.batchExport(analysisDataMap, batchOptions);
      
      setExportProgress(100);
      
      setTimeout(() => {
        alert(`Successfully exported ${exportedPaths.length} files!`);
        props.onClose?.();
      }, 500);

    } catch (error) {
      console.error('Batch export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div class="batch-export-modal">
      <div class="batch-export-container">
        <div class="batch-export-header">
          <h2>Batch Export Analysis Results</h2>
          <button class="close-button" onClick={props.onClose}>✕</button>
        </div>

        <div class="batch-export-content">
          <div class="export-section">
            <h3>Select Files to Export</h3>
            <div class="selection-controls">
              <button onClick={selectAll}>Select All</button>
              <button onClick={deselectAll}>Deselect All</button>
              <span class="selection-count">{selectedFiles.size} files selected</span>
            </div>
            
            <div class="file-list">
              <VirtualList
                items={completedAnalyses()}
                itemHeight={60}
                containerHeight={300}
                overscan={5}
                renderItem={(analysis) => (
                  <div 
                    class={`file-item ${selectedFiles.has(analysis.fileId) ? 'selected' : ''}`}
                    onClick={() => toggleFileSelection(analysis.fileId)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(analysis.fileId)}
                      onChange={() => toggleFileSelection(analysis.fileId)}
                    />
                    <div class="file-info">
                      <div class="file-name">{analysis.fileName}</div>
                      <div class="file-meta">
                        {new Date(analysis.timestamp).toLocaleDateString()} • 
                        {analysis.resultCount} results
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>

          <div class="export-section">
            <h3>Export Options</h3>
            
            <div class="option-group">
              <label>Export Format</label>
              <select
                value={exportOptions.format}
                onChange={(e) => setExportOptions('format', e.currentTarget.value as any)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="html">HTML Report</option>
                <option value="pdf">PDF Report</option>
                <option value="xlsx">Excel Spreadsheet</option>
                <option value="encrypted">Encrypted Archive</option>
              </select>
            </div>

            <div class="option-group">
              <label>Export Template</label>
              <select
                value={selectedTemplate()}
                onChange={(e) => handleTemplateChange(e.currentTarget.value)}
              >
                <option value="">No Template</option>
                <For each={templates}>
                  {(template) => (
                    <option value={template.id}>{template.name}</option>
                  )}
                </For>
              </select>
            </div>

            <div class="option-group">
              <label>File Naming</label>
              <select
                value={namingOption()}
                onChange={(e) => setNamingOption(e.currentTarget.value as any)}
              >
                <option value="original">Original Filename</option>
                <option value="sequential">Sequential (export_1, export_2...)</option>
                <option value="custom">Custom Pattern</option>
              </select>
            </div>

            <Show when={namingOption() === 'custom'}>
              <div class="option-group">
                <label>Naming Pattern</label>
                <input
                  type="text"
                  value={customPattern()}
                  onInput={(e) => setCustomPattern(e.currentTarget.value)}
                  placeholder="export_{index}_{timestamp}"
                />
                <small>Available variables: {'{index}'}, {'{fileId}'}, {'{timestamp}'}</small>
              </div>
            </Show>

            <div class="option-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) => setExportOptions('includeMetadata', e.currentTarget.checked)}
                />
                Include Metadata
              </label>
              
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.compression}
                  onChange={(e) => setExportOptions('compression', e.currentTarget.checked)}
                />
                Compress Files
              </label>
              
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.encryption?.enabled ?? false}
                  onChange={(e) => setExportOptions('encryption', { enabled: e.currentTarget.checked })}
                />
                Encrypt Export
              </label>
            </div>

            <Show when={exportOptions.encryption?.enabled}>
              <div class="option-group">
                <label>Encryption Password</label>
                <div class="password-input">
                  <input
                    type={showPassword() ? 'text' : 'password'}
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    placeholder="Enter strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="toggle-password"
                  >
                    {showPassword() ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </Show>
          </div>

          <Show when={isExporting()}>
            <div class="export-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  style={{ width: `${exportProgress()}%` }}
                />
              </div>
              <span class="progress-text">Exporting... {exportProgress().toFixed(0)}%</span>
            </div>
          </Show>
        </div>

        <div class="batch-export-footer">
          <button 
            class="cancel-button" 
            onClick={props.onClose}
            disabled={isExporting()}
          >
            Cancel
          </button>
          <button 
            class="export-button"
            onClick={handleBatchExport}
            disabled={selectedFiles.size === 0 || isExporting()}
          >
            {isExporting() ? 'Exporting...' : `Export ${selectedFiles.size} Files`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchExport;