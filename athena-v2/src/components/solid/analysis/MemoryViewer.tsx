import { Component, createSignal, createEffect, createMemo, For, Show, onCleanup } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import HexEditor from '../editors/HexEditor';
import { invokeCommand } from '../../../utils/tauriCompat';
import './MemoryViewer.css';

export interface MemoryDump {
  pid: number;
  timestamp: number;
  dump_path: string;
  trigger: string;
  size_bytes: number;
  process_name: string;
}

export interface ExtractedString {
  offset: number;
  value: string;
  encoding: 'ascii' | 'utf16' | 'utf8';
  suspicious: boolean;
}

export interface MemoryRegion {
  address: u64;
  size: number;
  protection: string;
  mapped_file?: string;
  is_executable: boolean;
  is_writable: boolean;
}

export interface VolatilityAnalysis {
  processes: VolProcess[];
  network_connections: VolNetConn[];
  malfind_results: MalfindHit[];
  loaded_modules: ModuleInfo[];
  api_hooks: ApiHook[];
}

export interface VolProcess {
  pid: number;
  ppid: number;
  name: string;
  path?: string;
  create_time?: string;
}

export interface VolNetConn {
  protocol: string;
  local_address: string;
  remote_address: string;
  state: string;
  pid: number;
}

export interface MalfindHit {
  pid: number;
  process_name: string;
  address: number;
  size: number;
  protection: string;
  disassembly: string[];
  likely_shellcode: boolean;
}

export interface ModuleInfo {
  name: string;
  path: string;
  base_address: number;
  size: number;
}

export interface ApiHook {
  function_name: string;
  hook_address: number;
  target_address: number;
  module: string;
}

type u64 = number;

type ViewMode = 'hex' | 'strings' | 'regions' | 'volatility';

interface MemoryViewerProps {
  memoryDumps: MemoryDump[];
  onAnalyzeWithVolatility?: (dumpPath: string) => void;
}

const MemoryViewer: Component<MemoryViewerProps> = (props) => {
  const [selectedDump, setSelectedDump] = createSignal<MemoryDump | null>(null);
  const [hexData, setHexData] = createSignal<Uint8Array | null>(null);
  const [strings, setStrings] = createSignal<ExtractedString[]>([]);
  const [regions, setRegions] = createSignal<MemoryRegion[]>([]);
  const [volatilityResults, setVolatilityResults] = createSignal<VolatilityAnalysis | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>('hex');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [stringFilter, setStringFilter] = createSignal('');
  const [showSuspiciousOnly, setShowSuspiciousOnly] = createSignal(false);
  const [volatilityLoading, setVolatilityLoading] = createSignal(false);
  const [hexOffset, setHexOffset] = createSignal(0);
  const [hexChunkSize] = createSignal(65536); // 64KB chunks

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format timestamp
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  // Format address as hex
  const formatAddress = (addr: number): string => {
    return '0x' + addr.toString(16).padStart(16, '0').toUpperCase();
  };

  // Load dump data when selected
  createEffect(async () => {
    const dump = selectedDump();
    if (!dump) {
      setHexData(null);
      setStrings([]);
      setRegions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load hex data (first chunk)
      const bytes = await invokeCommand('read_file_binary', {
        path: dump.dump_path,
        offset: hexOffset(),
        length: hexChunkSize()
      }) as number[];

      if (bytes && bytes.length > 0) {
        setHexData(new Uint8Array(bytes));
      }

      // Extract strings
      try {
        const extracted = await invokeCommand('extract_strings_from_dump', {
          path: dump.dump_path,
          minLength: 4
        }) as ExtractedString[];
        setStrings(extracted || []);
      } catch {
        // If command not available, generate basic strings from hex data
        if (bytes) {
          const basicStrings = extractBasicStrings(new Uint8Array(bytes));
          setStrings(basicStrings);
        }
      }

      // Try to get memory regions
      try {
        const memRegions = await invokeCommand('get_memory_regions', {
          path: dump.dump_path
        }) as MemoryRegion[];
        setRegions(memRegions || []);
      } catch {
        // Memory region parsing not available
        setRegions([]);
      }

    } catch (e) {
      console.error('Failed to load memory dump:', e);
      setError(e instanceof Error ? e.message : 'Failed to load memory dump');
    } finally {
      setLoading(false);
    }
  });

  // Basic string extraction fallback
  const extractBasicStrings = (data: Uint8Array): ExtractedString[] => {
    const results: ExtractedString[] = [];
    let currentString = '';
    let startOffset = 0;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      // Printable ASCII range
      if (byte >= 32 && byte <= 126) {
        if (currentString.length === 0) {
          startOffset = i;
        }
        currentString += String.fromCharCode(byte);
      } else {
        if (currentString.length >= 4) {
          const suspicious = isSuspiciousString(currentString);
          results.push({
            offset: startOffset,
            value: currentString,
            encoding: 'ascii',
            suspicious
          });
        }
        currentString = '';
      }
    }

    // Check last string
    if (currentString.length >= 4) {
      results.push({
        offset: startOffset,
        value: currentString,
        encoding: 'ascii',
        suspicious: isSuspiciousString(currentString)
      });
    }

    return results.slice(0, 1000); // Limit to 1000 strings
  };

  // Check if a string is suspicious
  const isSuspiciousString = (str: string): boolean => {
    const suspiciousPatterns = [
      /http[s]?:\/\//i,
      /\.exe$/i,
      /\.dll$/i,
      /cmd\.exe/i,
      /powershell/i,
      /base64/i,
      /password/i,
      /HKEY_/i,
      /CreateProcess/i,
      /VirtualAlloc/i,
      /WriteProcessMemory/i,
      /LoadLibrary/i,
      /GetProcAddress/i,
      /NtCreateThread/i,
      /shell32/i,
      /kernel32/i,
      /ntdll/i,
      /regsvr32/i,
      /mshta/i,
      /wscript/i,
      /cscript/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  // Filtered strings
  const filteredStrings = createMemo(() => {
    let result = strings();

    if (showSuspiciousOnly()) {
      result = result.filter(s => s.suspicious);
    }

    if (stringFilter()) {
      const filter = stringFilter().toLowerCase();
      result = result.filter(s => s.value.toLowerCase().includes(filter));
    }

    return result;
  });

  // Handle Volatility analysis
  const handleVolatilityAnalysis = async () => {
    const dump = selectedDump();
    if (!dump) return;

    setVolatilityLoading(true);
    setError(null);

    try {
      if (props.onAnalyzeWithVolatility) {
        props.onAnalyzeWithVolatility(dump.dump_path);
      }

      const results = await invokeCommand('analyze_memory_with_volatility', {
        dump_path: dump.dump_path,
        plugins: ['pslist', 'malfind', 'netscan']
      }) as VolatilityAnalysis;

      setVolatilityResults(results);
      setViewMode('volatility');
    } catch (e) {
      console.error('Volatility analysis failed:', e);
      setError(e instanceof Error ? e.message : 'Volatility analysis failed');
    } finally {
      setVolatilityLoading(false);
    }
  };

  // Navigate hex view
  const navigateHex = async (direction: 'prev' | 'next') => {
    const dump = selectedDump();
    if (!dump) return;

    const newOffset = direction === 'next'
      ? hexOffset() + hexChunkSize()
      : Math.max(0, hexOffset() - hexChunkSize());

    if (newOffset >= dump.size_bytes) return;

    setHexOffset(newOffset);
    setLoading(true);

    try {
      const bytes = await invokeCommand('read_file_binary', {
        path: dump.dump_path,
        offset: newOffset,
        length: hexChunkSize()
      }) as number[];

      if (bytes && bytes.length > 0) {
        setHexData(new Uint8Array(bytes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Go to specific offset
  const goToOffset = async (offset: number) => {
    const dump = selectedDump();
    if (!dump) return;

    const alignedOffset = Math.floor(offset / hexChunkSize()) * hexChunkSize();
    setHexOffset(alignedOffset);

    setLoading(true);
    try {
      const bytes = await invokeCommand('read_file_binary', {
        path: dump.dump_path,
        offset: alignedOffset,
        length: hexChunkSize()
      }) as number[];

      if (bytes && bytes.length > 0) {
        setHexData(new Uint8Array(bytes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnalysisPanel
      title="Memory Analysis"
      icon="Memory"
      className="memory-viewer-panel"
      actions={
        <div class="memory-actions">
          <Show when={selectedDump()}>
            <button
              class="btn btn-primary btn-sm"
              onClick={handleVolatilityAnalysis}
              disabled={volatilityLoading()}
            >
              {volatilityLoading() ? 'Analyzing...' : 'Analyze with Volatility'}
            </button>
          </Show>
        </div>
      }
    >
      <div class="memory-viewer-container">
        {/* Dump Selector */}
        <div class="dump-selector">
          <h4 class="section-title">Memory Dumps ({props.memoryDumps.length})</h4>
          <div class="dump-list">
            <For each={props.memoryDumps}>
              {(dump) => (
                <div
                  class={`dump-item ${selectedDump()?.dump_path === dump.dump_path ? 'selected' : ''}`}
                  onClick={() => setSelectedDump(dump)}
                >
                  <div class="dump-main">
                    <span class="dump-pid">PID {dump.pid}</span>
                    <span class="dump-name">{dump.process_name}</span>
                  </div>
                  <div class="dump-meta">
                    <span class={`dump-trigger ${dump.trigger.toLowerCase()}`}>{dump.trigger}</span>
                    <span class="dump-size">{formatBytes(dump.size_bytes)}</span>
                    <span class="dump-time">{formatTimestamp(dump.timestamp)}</span>
                  </div>
                </div>
              )}
            </For>
            <Show when={props.memoryDumps.length === 0}>
              <div class="no-dumps">
                No memory dumps captured yet. Run sandbox analysis to capture memory.
              </div>
            </Show>
          </div>
        </div>

        {/* Content Area */}
        <div class="memory-content">
          {/* View Mode Tabs */}
          <Show when={selectedDump()}>
            <div class="view-tabs">
              <button
                class={`tab-btn ${viewMode() === 'hex' ? 'active' : ''}`}
                onClick={() => setViewMode('hex')}
              >
                Hex View
              </button>
              <button
                class={`tab-btn ${viewMode() === 'strings' ? 'active' : ''}`}
                onClick={() => setViewMode('strings')}
              >
                Strings ({filteredStrings().length})
              </button>
              <button
                class={`tab-btn ${viewMode() === 'regions' ? 'active' : ''}`}
                onClick={() => setViewMode('regions')}
              >
                Regions ({regions().length})
              </button>
              <Show when={volatilityResults()}>
                <button
                  class={`tab-btn ${viewMode() === 'volatility' ? 'active' : ''}`}
                  onClick={() => setViewMode('volatility')}
                >
                  Volatility
                </button>
              </Show>
            </div>
          </Show>

          {/* Error Display */}
          <Show when={error()}>
            <div class="memory-error">
              <span>Error: {error()}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          </Show>

          {/* Loading State */}
          <Show when={loading()}>
            <div class="memory-loading">
              <div class="loading-spinner"></div>
              <span>Loading memory data...</span>
            </div>
          </Show>

          {/* No Selection */}
          <Show when={!selectedDump() && !loading()}>
            <div class="no-selection">
              <div class="no-selection-icon">*</div>
              <span>Select a memory dump to view</span>
            </div>
          </Show>

          {/* Hex View */}
          <Show when={viewMode() === 'hex' && hexData() && selectedDump() && !loading()}>
            <div class="hex-view-container">
              <div class="hex-navigation">
                <button
                  class="nav-btn"
                  onClick={() => navigateHex('prev')}
                  disabled={hexOffset() === 0}
                >
                  Previous
                </button>
                <span class="offset-display">
                  Offset: 0x{hexOffset().toString(16).toUpperCase()} -
                  0x{(hexOffset() + hexChunkSize()).toString(16).toUpperCase()}
                  {' '}({formatBytes(selectedDump()!.size_bytes)} total)
                </span>
                <button
                  class="nav-btn"
                  onClick={() => navigateHex('next')}
                  disabled={hexOffset() + hexChunkSize() >= selectedDump()!.size_bytes}
                >
                  Next
                </button>
              </div>
              <div class="hex-editor-wrapper">
                <HexEditor data={hexData()!} readOnly={true} />
              </div>
            </div>
          </Show>

          {/* Strings View */}
          <Show when={viewMode() === 'strings' && selectedDump() && !loading()}>
            <div class="strings-view-container">
              <div class="strings-toolbar">
                <input
                  type="text"
                  class="strings-filter"
                  placeholder="Filter strings..."
                  value={stringFilter()}
                  onInput={(e) => setStringFilter(e.currentTarget.value)}
                />
                <label class="suspicious-toggle">
                  <input
                    type="checkbox"
                    checked={showSuspiciousOnly()}
                    onChange={(e) => setShowSuspiciousOnly(e.currentTarget.checked)}
                  />
                  Suspicious only
                </label>
              </div>
              <div class="strings-list">
                <For each={filteredStrings().slice(0, 500)}>
                  {(str) => (
                    <div
                      class={`string-item ${str.suspicious ? 'suspicious' : ''}`}
                      onClick={() => goToOffset(str.offset)}
                    >
                      <span class="string-offset">
                        0x{str.offset.toString(16).padStart(8, '0')}
                      </span>
                      <span class="string-encoding">{str.encoding}</span>
                      <span class="string-value">{str.value}</span>
                      <Show when={str.suspicious}>
                        <span class="suspicious-badge">!</span>
                      </Show>
                    </div>
                  )}
                </For>
                <Show when={filteredStrings().length === 0}>
                  <div class="no-strings">No strings found matching criteria</div>
                </Show>
                <Show when={filteredStrings().length > 500}>
                  <div class="strings-more">
                    Showing 500 of {filteredStrings().length} strings. Use filter to narrow results.
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Regions View */}
          <Show when={viewMode() === 'regions' && selectedDump() && !loading()}>
            <div class="regions-view-container">
              <div class="regions-list">
                <div class="regions-header">
                  <span>Address</span>
                  <span>Size</span>
                  <span>Protection</span>
                  <span>Mapped File</span>
                </div>
                <For each={regions()}>
                  {(region) => (
                    <div
                      class={`region-item ${region.is_executable ? 'executable' : ''}`}
                      onClick={() => goToOffset(region.address)}
                    >
                      <span class="region-address">{formatAddress(region.address)}</span>
                      <span class="region-size">{formatBytes(region.size)}</span>
                      <span class={`region-protection ${region.is_executable ? 'exec' : ''} ${region.is_writable ? 'write' : ''}`}>
                        {region.protection}
                      </span>
                      <span class="region-file">{region.mapped_file || '-'}</span>
                    </div>
                  )}
                </For>
                <Show when={regions().length === 0}>
                  <div class="no-regions">
                    Memory region information not available for this dump format.
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Volatility Results View */}
          <Show when={viewMode() === 'volatility' && volatilityResults() && !loading()}>
            <div class="volatility-view-container">
              {/* Malfind Results */}
              <Show when={volatilityResults()!.malfind_results.length > 0}>
                <div class="volatility-section">
                  <h4 class="section-title danger">Malfind - Injected Code ({volatilityResults()!.malfind_results.length})</h4>
                  <div class="malfind-list">
                    <For each={volatilityResults()!.malfind_results}>
                      {(hit) => (
                        <div class={`malfind-item ${hit.likely_shellcode ? 'shellcode' : ''}`}>
                          <div class="malfind-header">
                            <span class="malfind-pid">PID {hit.pid}</span>
                            <span class="malfind-name">{hit.process_name}</span>
                            <span class="malfind-address">{formatAddress(hit.address)}</span>
                            <span class="malfind-size">{formatBytes(hit.size)}</span>
                            <Show when={hit.likely_shellcode}>
                              <span class="shellcode-badge">Shellcode</span>
                            </Show>
                          </div>
                          <div class="malfind-protection">{hit.protection}</div>
                          <Show when={hit.disassembly.length > 0}>
                            <div class="malfind-disasm">
                              <For each={hit.disassembly.slice(0, 5)}>
                                {(line) => <div class="disasm-line">{line}</div>}
                              </For>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Processes */}
              <Show when={volatilityResults()!.processes.length > 0}>
                <div class="volatility-section">
                  <h4 class="section-title">Process List ({volatilityResults()!.processes.length})</h4>
                  <div class="process-list">
                    <For each={volatilityResults()!.processes}>
                      {(proc) => (
                        <div class="process-item">
                          <span class="proc-pid">PID {proc.pid}</span>
                          <span class="proc-ppid">PPID {proc.ppid}</span>
                          <span class="proc-name">{proc.name}</span>
                          <span class="proc-path">{proc.path || ''}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Network Connections */}
              <Show when={volatilityResults()!.network_connections.length > 0}>
                <div class="volatility-section">
                  <h4 class="section-title">Network Connections ({volatilityResults()!.network_connections.length})</h4>
                  <div class="network-list">
                    <For each={volatilityResults()!.network_connections}>
                      {(conn) => (
                        <div class="network-item">
                          <span class="net-protocol">{conn.protocol}</span>
                          <span class="net-local">{conn.local_address}</span>
                          <span class="net-arrow">-&gt;</span>
                          <span class="net-remote">{conn.remote_address}</span>
                          <span class="net-state">{conn.state}</span>
                          <span class="net-pid">PID {conn.pid}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* API Hooks */}
              <Show when={volatilityResults()!.api_hooks.length > 0}>
                <div class="volatility-section">
                  <h4 class="section-title warning">API Hooks ({volatilityResults()!.api_hooks.length})</h4>
                  <div class="hooks-list">
                    <For each={volatilityResults()!.api_hooks}>
                      {(hook) => (
                        <div class="hook-item">
                          <span class="hook-function">{hook.function_name}</span>
                          <span class="hook-module">{hook.module}</span>
                          <span class="hook-address">
                            {formatAddress(hook.hook_address)} -&gt; {formatAddress(hook.target_address)}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={
                volatilityResults()!.malfind_results.length === 0 &&
                volatilityResults()!.processes.length === 0 &&
                volatilityResults()!.network_connections.length === 0 &&
                volatilityResults()!.api_hooks.length === 0
              }>
                <div class="no-volatility">
                  No suspicious findings from Volatility analysis.
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </AnalysisPanel>
  );
};

export default MemoryViewer;
