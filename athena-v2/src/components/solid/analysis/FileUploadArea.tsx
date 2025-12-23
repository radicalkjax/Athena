import { Component, createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import { memoryManager } from '../../../services/memoryManager';
import { StatCard } from '../shared/StatCard';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invokeCommand, openFileDialog, isTauri } from '../../../utils/tauriCompat';
import { logger } from '../../../services/loggingService';

// Analysis configuration interface
interface AnalysisConfig {
  // Analysis types
  staticAnalysis: boolean;
  dynamicAnalysis: boolean;
  aiEnsemble: boolean;
  reverseEngineering: boolean;
  // Sandbox configuration
  sandboxOS: 'linux' | 'windows' | 'macos';
  sandboxArch: 'x86_64' | 'arm64';
  sandboxImage: string;
  sandboxTimeout: number;      // seconds
  sandboxMemory: number;       // MB
  sandboxCPU: number;          // cores (0.5 = 50%)
  captureNetwork: boolean;
}

interface AnalysisStats {
  samples_analyzed_today: number;
  avg_analysis_time_ms: number;
  ai_provider_accuracy: number;
}

// Staged sample from quarantine storage
interface StagedSample {
  sha256: string;
  original_filename: string;
  size: number;
  file_type: string;
  mime_type: string;
  status: string;
  uploaded_at: string;
  tags: string[];
}

// Full sample metadata from backend
interface SampleMetadata {
  sha256: string;
  original_filename: string;
  size: u64;
  file_type: any;
  mime_type: string;
  status: string;
  uploaded_at: string;
  last_analyzed: string | null;
  analysis_count: number;
  tags: string[];
  notes: string | null;
  risk_score: number | null;
}

// Type for backward compatibility
type u64 = number;

interface UploadResult {
  sha256: string;
  is_duplicate: boolean;
  file_type: string;
  size: number;
  message: string;
}

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  status: string;
}

export const FileUploadArea: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isUploading, setIsUploading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [uploadProgress, setUploadProgress] = createSignal<UploadProgress | null>(null);

  // Staged samples list
  const [stagedSamples, setStagedSamples] = createSignal<StagedSample[]>([]);
  const [selectedSamples, setSelectedSamples] = createSignal<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);

  // Docker availability
  const [dockerAvailable, setDockerAvailable] = createSignal<boolean | null>(null);

  // Analysis configuration state
  const [analysisConfig, setAnalysisConfig] = createSignal<AnalysisConfig>({
    staticAnalysis: true,
    dynamicAnalysis: true,
    aiEnsemble: true,
    reverseEngineering: false,
    sandboxOS: 'linux',
    sandboxArch: 'x86_64',
    sandboxImage: 'ubuntu:22.04',
    sandboxTimeout: 120,
    sandboxMemory: 512,
    sandboxCPU: 1.0,
    captureNetwork: true,
  });

  // Analysis stats from backend
  const [stats, setStats] = createSignal<AnalysisStats>({
    samples_analyzed_today: 0,
    avg_analysis_time_ms: 0,
    ai_provider_accuracy: 0
  });

  // Sample management state
  const [selectedSampleForDetails, setSelectedSampleForDetails] = createSignal<string | null>(null);
  const [sampleDetails, setSampleDetails] = createSignal<SampleMetadata | null>(null);
  const [allSamples, setAllSamples] = createSignal<StagedSample[]>([]);
  const [showSampleHistory, setShowSampleHistory] = createSignal(false);
  const [editingTags, setEditingTags] = createSignal<string | null>(null);
  const [tagInput, setTagInput] = createSignal('');
  const [editingNotes, setEditingNotes] = createSignal<string | null>(null);
  const [notesInput, setNotesInput] = createSignal('');

  // Container image options based on selected OS
  const getImageOptions = () => {
    const os = analysisConfig().sandboxOS;
    if (os === 'linux') {
      return [
        { value: 'ubuntu:22.04', label: 'Ubuntu 22.04 LTS (Recommended)' },
        { value: 'ubuntu:20.04', label: 'Ubuntu 20.04 LTS' },
        { value: 'debian:12', label: 'Debian 12 (Bookworm)' },
        { value: 'alpine:latest', label: 'Alpine Linux (Minimal)' },
        { value: 'fedora:39', label: 'Fedora 39' },
        { value: 'athena-sandbox:latest', label: 'Athena Sandbox (Full Monitoring)' },
      ];
    } else if (os === 'windows') {
      return [
        { value: 'mcr.microsoft.com/windows/servercore:ltsc2022', label: 'Windows Server 2022 Core' },
        { value: 'mcr.microsoft.com/windows/servercore:ltsc2019', label: 'Windows Server 2019 Core' },
        { value: 'athena-sandbox-windows:latest', label: 'Athena Windows Sandbox' },
      ];
    } else {
      // macOS - requires Anka or macOS VMs
      return [
        { value: 'macos-sonoma:14', label: 'macOS Sonoma 14 (Recommended)' },
        { value: 'macos-ventura:13', label: 'macOS Ventura 13' },
        { value: 'macos-monterey:12', label: 'macOS Monterey 12' },
        { value: 'athena-sandbox-macos:latest', label: 'Athena macOS Sandbox' },
      ];
    }
  };

  // Check Docker availability on mount
  const checkDockerAvailability = async () => {
    try {
      const available = await invokeCommand('check_docker_available') as boolean;
      setDockerAvailable(available);
    } catch (err) {
      console.warn('Docker check failed:', err);
      setDockerAvailable(false);
    }
  };

  let unlistenProgress: (() => void) | null = null;

  // Fetch stats from backend
  const fetchStats = async () => {
    try {
      const result = await invokeCommand('get_analysis_stats') as AnalysisStats;
      setStats(result);
    } catch (err) {
      console.warn('Failed to fetch analysis stats:', err);
    }
  };

  // Fetch staged samples from quarantine
  const fetchStagedSamples = async () => {
    try {
      const samples = await invokeCommand('list_staged_samples') as StagedSample[];
      setStagedSamples(samples);
    } catch (err) {
      console.warn('Failed to fetch staged samples:', err);
    }
  };

  // Fetch all samples (for history view)
  const fetchAllSamples = async () => {
    try {
      const samples = await invokeCommand('list_all_samples') as StagedSample[];
      setAllSamples(samples);
    } catch (err) {
      console.warn('Failed to fetch all samples:', err);
    }
  };

  // Fetch sample details
  const fetchSampleDetails = async (sha256: string) => {
    try {
      const details = await invokeCommand('get_sample_metadata', { sha256 }) as SampleMetadata;
      setSampleDetails(details);
      setSelectedSampleForDetails(sha256);
    } catch (err) {
      setError(`Failed to load sample details: ${err}`);
    }
  };

  // Update sample tags
  const updateTags = async (sha256: string, tags: string[]) => {
    try {
      await invokeCommand('update_sample_tags', { sha256, tags });
      setEditingTags(null);
      setTagInput('');
      await fetchStagedSamples();
      await fetchAllSamples();
      if (selectedSampleForDetails() === sha256) {
        await fetchSampleDetails(sha256);
      }
      setSuccessMessage('Tags updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to update tags: ${err}`);
    }
  };

  // Update sample notes
  const updateNotes = async (sha256: string, notes: string | null) => {
    try {
      await invokeCommand('update_sample_notes', { sha256, notes });
      setEditingNotes(null);
      setNotesInput('');
      if (selectedSampleForDetails() === sha256) {
        await fetchSampleDetails(sha256);
      }
      setSuccessMessage('Notes updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to update notes: ${err}`);
    }
  };

  // Check if sample exists (for duplicate detection)
  const checkSampleExists = async (sha256: string): Promise<boolean> => {
    try {
      return await invokeCommand('sample_exists', { sha256 }) as boolean;
    } catch (err) {
      console.warn('Failed to check sample existence:', err);
      return false;
    }
  };

  onMount(async () => {
    // Fetch initial data and check Docker
    await Promise.all([fetchStats(), fetchStagedSamples(), fetchAllSamples(), checkDockerAvailability()]);

    // Refresh stats every 30 seconds
    const statsInterval = setInterval(fetchStats, 30000);
    // Refresh staged samples every 10 seconds
    const samplesInterval = setInterval(fetchStagedSamples, 10000);
    // Refresh all samples every 30 seconds
    const allSamplesInterval = setInterval(fetchAllSamples, 30000);

    // Listen for upload progress events (only in Tauri)
    if (isTauri()) {
      try {
        // @ts-ignore - Tauri API
        const { listen } = window.__TAURI__.event;
        unlistenProgress = await listen('upload-progress', (event: any) => {
          setUploadProgress(event.payload);

          if (event.payload.status === 'completed') {
            setTimeout(() => setUploadProgress(null), 1000);
            // Refresh data after upload
            fetchStats();
            fetchStagedSamples();
          }
        });
      } catch (err) {
        console.warn('Tauri event API not available:', err);
      }
    }

    // Cleanup intervals on unmount
    onCleanup(() => {
      clearInterval(statsInterval);
      clearInterval(samplesInterval);
      clearInterval(allSamplesInterval);
    });
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
          await registerSample(selected);
        }
      } else {
        // Web file selection
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            await registerWebFile(file);
          }
        };
        input.click();
      }
    } catch (err) {
      setError(`Failed to select file: ${err}`);
    }
  };

  // Register a web file (create temp file and register)
  const registerWebFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Read file as array buffer
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));

      // Create a temporary file in Tauri's app data directory
      const tempPath = await invokeCommand('create_temp_file', {
        fileName: file.name,
        bytes
      }) as string;

      if (tempPath) {
        await registerSample(tempPath, file.name);
      } else {
        throw new Error('Failed to create temporary file');
      }
    } catch (err) {
      setError(`Failed to upload file: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Register sample in quarantine (staging only, no analysis)
  const registerSample = async (filePath: string, originalFilename?: string) => {
    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Register the sample in quarantine storage
      const result = await invokeCommand('register_sample', {
        filePath,
        originalFilename: originalFilename || null
      }) as UploadResult;

      // Show success message
      if (result.is_duplicate) {
        setSuccessMessage(`Sample already exists: ${result.file_type} (${formatBytes(result.size)})`);
      } else {
        setSuccessMessage(`Sample registered: ${result.file_type} (${formatBytes(result.size)})`);
      }

      // Refresh the staged samples list
      await fetchStagedSamples();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(`Failed to register sample: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Start analysis for selected samples
  const startAnalysis = async () => {
    const selected = Array.from(selectedSamples());
    if (selected.length === 0) {
      setError('No samples selected for analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const config = analysisConfig();

      for (const sha256 of selected) {
        // Start sample analysis (moves to staging and returns path)
        const stagedPath = await invokeCommand('start_sample_analysis', { sha256 }) as string;

        // Run the actual analysis
        const analysisResult = await invokeCommand('analyze_file', {
          filePath: stagedPath,
          config: {
            static_analysis: config.staticAnalysis,
            dynamic_analysis: config.dynamicAnalysis,
            ai_ensemble: config.aiEnsemble,
            reverse_engineering: config.reverseEngineering,
            // Sandbox configuration
            sandbox_os: config.sandboxOS,
            sandbox_arch: config.sandboxArch,
            sandbox_image: config.sandboxImage,
            sandbox_timeout: config.sandboxTimeout,
            sandbox_memory: config.sandboxMemory,
            sandbox_cpu: config.sandboxCPU,
            capture_network: config.captureNetwork,
          }
        });

        // Mark analysis as complete
        await invokeCommand('complete_sample_analysis', { sha256 });

        // Add to analysis store
        const sample = stagedSamples().find(s => s.sha256 === sha256);
        if (sample && analysisResult) {
          analysisStore.addFile({
            name: sample.original_filename,
            path: stagedPath,
            size: sample.size,
            hash: sha256,
            type: sample.mime_type,
            analysisResult: analysisResult
          });

          // Allocate memory for the file
          const fileId = `file_${sha256}`;
          memoryManager.allocate(
            fileId,
            sample.size,
            'file',
            `File: ${sample.original_filename}`,
            () => logger.debug(`Memory freed for file ${sample.original_filename}`)
          );

          // Trigger analysis completed event
          window.dispatchEvent(new CustomEvent('file-analyzed', {
            detail: { filePath: stagedPath, result: analysisResult }
          }));
        }
      }

      // Clear selection and refresh
      setSelectedSamples(new Set<string>());
      await fetchStagedSamples();
      await fetchStats();

      setSuccessMessage(`Analysis complete for ${selected.length} sample(s)`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(`Analysis failed: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Delete selected samples
  const deleteSelectedSamples = async () => {
    const selected = Array.from(selectedSamples());
    if (selected.length === 0) return;

    try {
      for (const sha256 of selected) {
        await invokeCommand('delete_staged_sample', { sha256 });
      }
      setSelectedSamples(new Set<string>());
      await fetchStagedSamples();
      setSuccessMessage(`Deleted ${selected.length} sample(s)`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to delete samples: ${err}`);
    }
  };

  // Toggle sample selection
  const toggleSampleSelection = (sha256: string) => {
    setSelectedSamples(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sha256)) {
        newSet.delete(sha256);
      } else {
        newSet.add(sha256);
      }
      return newSet;
    });
  };

  // Select all samples
  const selectAllSamples = () => {
    const allSha256 = stagedSamples().map(s => s.sha256);
    setSelectedSamples(new Set(allSha256));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSamples(new Set<string>());
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Format timestamp
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString();
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
        try {
          const buffer = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));

          const tempPath = await invokeCommand('create_temp_file', {
            fileName: file.name,
            bytes
          }) as string;

          if (tempPath) {
            await registerSample(tempPath, file.name);
          } else {
            await registerWebFile(file);
          }
        } catch (err) {
          logger.warn('Failed to handle Tauri file drop, falling back to web method', err);
          await registerWebFile(file);
        }
      } else {
        await registerWebFile(file);
      }
    }
  };

  // Add tag to sample
  const handleAddTag = (sha256: string, currentTags: string[]) => {
    const newTag = tagInput().trim();
    if (newTag && !currentTags.includes(newTag)) {
      const updatedTags = [...currentTags, newTag];
      updateTags(sha256, updatedTags);
    }
  };

  // Remove tag from sample
  const handleRemoveTag = (sha256: string, currentTags: string[], tagToRemove: string) => {
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    updateTags(sha256, updatedTags);
  };

  // Load sample for re-analysis
  const reanalyzeSample = async (sha256: string) => {
    try {
      // Select the sample
      const newSelection = new Set([sha256]);
      setSelectedSamples(newSelection);

      // Switch to staged samples view
      setShowSampleHistory(false);

      // Scroll to staged samples section
      setSuccessMessage(`Sample ${sha256.substring(0, 16)}... ready for re-analysis`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to prepare sample for re-analysis: ${err}`);
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
          <strong>Files are staged securely until you start analysis</strong>
        </p>
        <button class="btn btn-primary">Choose Files</button>
      </div>

      <Show when={error()}>
        <div class="error-message" style="color: var(--danger-color); margin-top: 10px; padding: 10px; background: rgba(255, 0, 0, 0.1); border-radius: 4px;">
          ❌ {error()}
        </div>
      </Show>

      <Show when={successMessage()}>
        <div style="color: var(--success-color); margin-top: 10px; padding: 10px; background: rgba(0, 255, 0, 0.1); border-radius: 4px;">
          ✅ {successMessage()}
        </div>
      </Show>

      <Show when={isUploading()}>
        <div class="upload-progress" style="margin-top: 20px;">
          <p>Uploading file... {uploadProgress()?.percentage?.toFixed(1) || 0}%</p>
          <div class="progress-bar" style="width: 100%; height: 6px; background: var(--accent-bg); border-radius: 3px; overflow: hidden; position: relative;">
            <div
              class="progress-fill"
              style={`width: ${uploadProgress()?.percentage || 0}%; height: 100%; background: var(--barbie-pink); transition: width 0.3s ease;`}
            ></div>
          </div>
        </div>
      </Show>

      {/* Sample History Toggle */}
      <div style="margin-top: 30px;">
        <button
          class="btn btn-secondary"
          onClick={() => setShowSampleHistory(!showSampleHistory())}
          style="width: 100%; display: flex; justify-content: space-between; align-items: center;"
        >
          <span>{showSampleHistory() ? '📦 Hide Sample History' : '📚 Show Sample History'}</span>
          <span>{showSampleHistory() ? '▼' : '▶'}</span>
        </button>
      </div>

      {/* Sample History Panel */}
      <Show when={showSampleHistory()}>
        <div style="margin-top: 20px; padding: 20px; background: var(--panel-bg); border-radius: 8px; border: 1px solid var(--border-color);">
          <h3 style="margin: 0 0 15px 0; color: var(--text-primary);">
            📚 All Samples ({allSamples().length})
          </h3>

          <div style="max-height: 400px; overflow-y: auto;">
            <Show when={allSamples().length === 0}>
              <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                No samples found. Upload your first sample above.
              </p>
            </Show>

            <For each={allSamples()}>
              {(sample) => (
                <div
                  style="padding: 15px; margin-bottom: 10px; background: var(--accent-bg); border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;"
                  onClick={() => fetchSampleDetails(sample.sha256)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--barbie-pink)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                      <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 4px;">
                        {sample.original_filename}
                      </div>
                      <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-secondary);">
                        SHA256: {sample.sha256.substring(0, 16)}...
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <span style="padding: 4px 8px; background: var(--panel-bg); border-radius: 4px; font-size: 0.8rem; color: var(--text-primary);">
                        {sample.file_type}
                      </span>
                      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                        {formatBytes(sample.size)}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    <For each={sample.tags}>
                      {(tag) => (
                        <span style="padding: 2px 8px; background: var(--barbie-pink); color: white; border-radius: 12px; font-size: 0.75rem;">
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-secondary);">
                    <span>Status: {sample.status}</span>
                    <span>{formatTime(sample.uploaded_at)}</span>
                  </div>

                  <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button
                      class="btn btn-primary"
                      style="flex: 1; font-size: 0.8rem; padding: 6px 12px;"
                      onClick={(e) => {
                        e.stopPropagation();
                        reanalyzeSample(sample.sha256);
                      }}
                    >
                      Re-analyze
                    </button>
                    <button
                      class="btn btn-secondary"
                      style="font-size: 0.8rem; padding: 6px 12px;"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchSampleDetails(sample.sha256);
                      }}
                    >
                      Details
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Sample Details Panel */}
      <Show when={sampleDetails() !== null}>
        <div style="margin-top: 20px; padding: 20px; background: var(--panel-bg); border-radius: 8px; border: 1px solid var(--barbie-pink);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: var(--text-primary);">
              🔍 Sample Details
            </h3>
            <button
              class="btn btn-secondary"
              style="font-size: 0.8rem; padding: 6px 12px;"
              onClick={() => {
                setSampleDetails(null);
                setSelectedSampleForDetails(null);
                setEditingTags(null);
                setEditingNotes(null);
              }}
            >
              Close
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Filename:</label>
              <div style="color: var(--text-primary); font-weight: 500; margin-top: 4px;">
                {sampleDetails()?.original_filename}
              </div>
            </div>
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">File Type:</label>
              <div style="color: var(--text-primary); margin-top: 4px;">
                {sampleDetails()?.mime_type}
              </div>
            </div>
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Size:</label>
              <div style="color: var(--text-primary); font-family: 'JetBrains Mono', monospace; margin-top: 4px;">
                {formatBytes(sampleDetails()?.size || 0)}
              </div>
            </div>
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Status:</label>
              <div style="color: var(--text-primary); margin-top: 4px;">
                {sampleDetails()?.status}
              </div>
            </div>
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">First Seen:</label>
              <div style="color: var(--text-primary); font-size: 0.85rem; margin-top: 4px;">
                {sampleDetails() ? formatTime(sampleDetails()!.uploaded_at) : ''}
              </div>
            </div>
            <div>
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Analysis Count:</label>
              <div style="color: var(--text-primary); margin-top: 4px;">
                {sampleDetails()?.analysis_count || 0} times
              </div>
            </div>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 8px; display: block;">
              SHA256:
            </label>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-primary); background: var(--accent-bg); padding: 8px; border-radius: 4px; word-break: break-all;">
              {sampleDetails()?.sha256}
            </div>
          </div>

          {/* Tags Section */}
          <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Tags:</label>
              <Show when={editingTags() !== sampleDetails()?.sha256}>
                <button
                  class="btn btn-secondary"
                  style="font-size: 0.75rem; padding: 4px 8px;"
                  onClick={() => {
                    setEditingTags(sampleDetails()?.sha256 || null);
                    setTagInput('');
                  }}
                >
                  Edit Tags
                </button>
              </Show>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
              <For each={sampleDetails()?.tags || []}>
                {(tag) => (
                  <span style="padding: 4px 12px; background: var(--barbie-pink); color: white; border-radius: 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                    {tag}
                    <Show when={editingTags() === sampleDetails()?.sha256}>
                      <button
                        onClick={() => handleRemoveTag(sampleDetails()!.sha256, sampleDetails()!.tags, tag)}
                        style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 1rem; line-height: 1;"
                      >
                        ×
                      </button>
                    </Show>
                  </span>
                )}
              </For>
            </div>

            <Show when={editingTags() === sampleDetails()?.sha256}>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  value={tagInput()}
                  onInput={(e) => setTagInput(e.currentTarget.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag(sampleDetails()!.sha256, sampleDetails()!.tags);
                    }
                  }}
                  placeholder="Enter tag name..."
                  style="flex: 1; padding: 8px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                />
                <button
                  class="btn btn-primary"
                  style="padding: 8px 16px;"
                  onClick={() => handleAddTag(sampleDetails()!.sha256, sampleDetails()!.tags)}
                  disabled={!tagInput().trim()}
                >
                  Add
                </button>
                <button
                  class="btn btn-secondary"
                  style="padding: 8px 16px;"
                  onClick={() => {
                    setEditingTags(null);
                    setTagInput('');
                  }}
                >
                  Done
                </button>
              </div>
            </Show>
          </div>

          {/* Notes Section */}
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Notes:</label>
              <Show when={editingNotes() !== sampleDetails()?.sha256}>
                <button
                  class="btn btn-secondary"
                  style="font-size: 0.75rem; padding: 4px 8px;"
                  onClick={() => {
                    setEditingNotes(sampleDetails()?.sha256 || null);
                    setNotesInput(sampleDetails()?.notes || '');
                  }}
                >
                  Edit Notes
                </button>
              </Show>
            </div>

            <Show when={editingNotes() === sampleDetails()?.sha256}>
              <div>
                <textarea
                  value={notesInput()}
                  onInput={(e) => setNotesInput(e.currentTarget.value)}
                  placeholder="Add analysis notes..."
                  rows={4}
                  style="width: 100%; padding: 8px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; resize: vertical;"
                ></textarea>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                  <button
                    class="btn btn-primary"
                    style="padding: 8px 16px;"
                    onClick={() => updateNotes(sampleDetails()!.sha256, notesInput() || null)}
                  >
                    Save Notes
                  </button>
                  <button
                    class="btn btn-secondary"
                    style="padding: 8px 16px;"
                    onClick={() => {
                      setEditingNotes(null);
                      setNotesInput('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Show>

            <Show when={editingNotes() !== sampleDetails()?.sha256}>
              <div style="padding: 10px; background: var(--accent-bg); border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--text-primary); white-space: pre-wrap; min-height: 60px;">
                {sampleDetails()?.notes || 'No notes added yet.'}
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Staged Samples Section */}
      <Show when={stagedSamples().length > 0}>
        <div style="margin-top: 30px; padding: 20px; background: var(--panel-bg); border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: var(--text-primary);">
              📦 Staged Samples ({stagedSamples().length})
            </h3>
            <div style="display: flex; gap: 10px;">
              <button
                class="btn btn-secondary"
                style="font-size: 0.85rem; padding: 6px 12px;"
                onClick={selectAllSamples}
              >
                Select All
              </button>
              <button
                class="btn btn-secondary"
                style="font-size: 0.85rem; padding: 6px 12px;"
                onClick={clearSelection}
                disabled={selectedSamples().size === 0}
              >
                Deselect
              </button>
            </div>
          </div>

          <div style="max-height: 300px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th style="padding: 10px; text-align: left; width: 40px;"></th>
                  <th style="padding: 10px; text-align: left;">Filename</th>
                  <th style="padding: 10px; text-align: left;">Type</th>
                  <th style="padding: 10px; text-align: left;">Tags</th>
                  <th style="padding: 10px; text-align: right;">Size</th>
                  <th style="padding: 10px; text-align: left;">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                <For each={stagedSamples()}>
                  {(sample) => (
                    <tr
                      style={`border-bottom: 1px solid var(--border-color); cursor: pointer; ${selectedSamples().has(sample.sha256) ? 'background: rgba(255, 105, 180, 0.1);' : ''}`}
                      onClick={() => toggleSampleSelection(sample.sha256)}
                    >
                      <td style="padding: 10px;">
                        <input
                          type="checkbox"
                          checked={selectedSamples().has(sample.sha256)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSampleSelection(sample.sha256)}
                          style="accent-color: var(--barbie-pink);"
                        />
                      </td>
                      <td style="padding: 10px; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
                        {sample.original_filename}
                        <br/>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">
                          {sample.sha256.substring(0, 16)}...
                        </span>
                      </td>
                      <td style="padding: 10px;">
                        <span style="padding: 2px 8px; background: var(--accent-bg); border-radius: 4px; font-size: 0.85rem;">
                          {sample.file_type}
                        </span>
                      </td>
                      <td style="padding: 10px;">
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                          <For each={sample.tags}>
                            {(tag) => (
                              <span style="padding: 2px 6px; background: var(--barbie-pink); color: white; border-radius: 10px; font-size: 0.7rem;">
                                {tag}
                              </span>
                            )}
                          </For>
                          <button
                            class="btn btn-secondary"
                            style="font-size: 0.7rem; padding: 2px 6px; border-radius: 10px;"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchSampleDetails(sample.sha256);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style="padding: 10px; text-align: right; font-family: 'JetBrains Mono', monospace;">
                        {formatBytes(sample.size)}
                      </td>
                      <td style="padding: 10px; font-size: 0.85rem; color: var(--text-secondary);">
                        {formatTime(sample.uploaded_at)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div style="display: flex; gap: 15px; margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border-color);">
            <button
              class="btn btn-primary"
              style="flex: 1;"
              onClick={startAnalysis}
              disabled={selectedSamples().size === 0 || isAnalyzing()}
            >
              {isAnalyzing() ? '⏳ Analyzing...' : `🔬 Start Analysis (${selectedSamples().size} selected)`}
            </button>
            <button
              class="btn btn-danger"
              style="padding: 10px 20px;"
              onClick={deleteSelectedSamples}
              disabled={selectedSamples().size === 0}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </Show>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
        <AnalysisPanel title="Analysis Configuration" icon="⚙️">
          <div style="padding: 20px;">
            <h4 style="margin: 0 0 15px 0; font-size: 0.9rem; color: var(--text-primary);">Analysis Types</h4>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={analysisConfig().staticAnalysis}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, staticAnalysis: e.currentTarget.checked }))}
                  style="accent-color: var(--barbie-pink);"
                />
                <span style="color: var(--text-primary);">Static Analysis (File properties, hashes, entropy)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={analysisConfig().dynamicAnalysis}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, dynamicAnalysis: e.currentTarget.checked }))}
                  style="accent-color: var(--barbie-pink);"
                />
                <span style="color: var(--text-primary);">Dynamic Analysis (CAPE Sandbox)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={analysisConfig().aiEnsemble}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, aiEnsemble: e.currentTarget.checked }))}
                  style="accent-color: var(--barbie-pink);"
                />
                <span style="color: var(--text-primary);">AI Provider Ensemble (All 6 Models)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={analysisConfig().reverseEngineering}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, reverseEngineering: e.currentTarget.checked }))}
                  style="accent-color: var(--barbie-pink);"
                />
                <span style="color: var(--text-primary);">Advanced Reverse Engineering</span>
              </label>
            </div>

            <h4 style="margin: 20px 0 15px 0; font-size: 0.9rem; color: var(--text-primary);">
              Sandbox Environment
              {dockerAvailable() === false && (
                <span style="color: var(--danger-color); font-size: 0.75rem; margin-left: 10px;">
                  (Docker not available)
                </span>
              )}
              {dockerAvailable() === true && (
                <span style="color: var(--success-color); font-size: 0.75rem; margin-left: 10px;">
                  (Docker ready)
                </span>
              )}
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
              <div>
                <label style="color: var(--text-secondary); font-size: 0.85rem;">Target OS:</label>
                <select
                  value={analysisConfig().sandboxOS}
                  onChange={(e) => {
                    const newOS = e.currentTarget.value as 'linux' | 'windows' | 'macos';
                    const defaultImages = {
                      linux: 'ubuntu:22.04',
                      windows: 'mcr.microsoft.com/windows/servercore:ltsc2022',
                      macos: 'macos-sonoma:14',
                    } as const;
                    setAnalysisConfig(prev => ({
                      ...prev,
                      sandboxOS: newOS,
                      sandboxImage: defaultImages[newOS] || 'ubuntu:22.04'
                    }));
                  }}
                  style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                >
                  <option value="linux">Linux</option>
                  <option value="macos">macOS</option>
                  <option value="windows">Windows</option>
                </select>
              </div>
              <div>
                <label style="color: var(--text-secondary); font-size: 0.85rem;">Architecture:</label>
                <select
                  value={analysisConfig().sandboxArch}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, sandboxArch: e.currentTarget.value as 'x86_64' | 'arm64' }))}
                  style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                >
                  <option value="x86_64">x86-64 (AMD64)</option>
                  <option value="arm64">ARM64 (Apple Silicon)</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">Container Image:</label>
              <select
                value={analysisConfig().sandboxImage}
                onChange={(e) => setAnalysisConfig(prev => ({ ...prev, sandboxImage: e.currentTarget.value }))}
                style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
              >
                {getImageOptions().map((opt: { value: string; label: string }) => (
                  <option value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
              <div>
                <label style="color: var(--text-secondary); font-size: 0.85rem;">Timeout (seconds):</label>
                <input
                  type="number"
                  min="30"
                  max="600"
                  value={analysisConfig().sandboxTimeout}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, sandboxTimeout: parseInt(e.currentTarget.value) || 120 }))}
                  style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                />
              </div>
              <div>
                <label style="color: var(--text-secondary); font-size: 0.85rem;">Memory (MB):</label>
                <input
                  type="number"
                  min="128"
                  max="4096"
                  step="128"
                  value={analysisConfig().sandboxMemory}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, sandboxMemory: parseInt(e.currentTarget.value) || 512 }))}
                  style="width: 100%; padding: 8px; margin-top: 5px; background: var(--accent-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;"
                />
              </div>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="color: var(--text-secondary); font-size: 0.85rem;">CPU Limit (cores):</label>
              <input
                type="range"
                min="0.25"
                max="4"
                step="0.25"
                value={analysisConfig().sandboxCPU}
                onChange={(e) => setAnalysisConfig(prev => ({ ...prev, sandboxCPU: parseFloat(e.currentTarget.value) || 1.0 }))}
                style="width: 100%; margin-top: 5px;"
              />
              <span style="color: var(--text-primary); font-size: 0.85rem;">{analysisConfig().sandboxCPU} cores</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={analysisConfig().captureNetwork}
                  onChange={(e) => setAnalysisConfig(prev => ({ ...prev, captureNetwork: e.currentTarget.checked }))}
                  style="accent-color: var(--barbie-pink);"
                />
                <span style="color: var(--text-primary); font-size: 0.9rem;">Capture Network Traffic (PCAP)</span>
              </label>
            </div>

            <div style="padding: 10px; background: var(--accent-bg); border-radius: 4px; font-size: 0.85rem;">
              <div style="color: var(--info-color);">
                <strong>Config:</strong> {analysisConfig().sandboxOS.toUpperCase()} ({analysisConfig().sandboxArch}) · {analysisConfig().sandboxImage.split(':')[0]} · {analysisConfig().sandboxMemory}MB · {analysisConfig().sandboxTimeout}s
              </div>
            </div>
          </div>
        </AnalysisPanel>

        <AnalysisPanel title="Quick Stats" icon="📊">
          <div class="stats-overview" style="grid-template-columns: 1fr; padding: 20px;">
            <StatCard value={stats().samples_analyzed_today.toLocaleString()} label="Samples Analyzed Today" />
            <StatCard value={`${stats().ai_provider_accuracy.toFixed(1)}%`} label="AI Provider Accuracy" />
            <StatCard value={`${(stats().avg_analysis_time_ms / 1000).toFixed(1)}s`} label="Avg Analysis Time" />
            <StatCard value={stagedSamples().length.toString()} label="Samples Staged" />
          </div>
        </AnalysisPanel>
      </div>
    </div>
  );
};
