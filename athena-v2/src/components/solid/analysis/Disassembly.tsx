import { createSignal, createEffect, Show, For } from 'solid-js';
import DisassemblyViewer from '../visualization/DisassemblyViewer';
import ControlFlowGraph from '../visualization/ControlFlowGraph';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import { invokeCommand } from '../../../utils/tauriCompat';
import { analysisStore } from '../../../stores/analysisStore';
import type { DisassemblyResult } from '../../../types/disassembly';
import './Disassembly.css';

interface DisassemblyProps {
  filePath?: string;
}

interface FunctionInfo {
  name: string;
  address: string;
  size: string;
  type: string;
}

export default function Disassembly(props: DisassemblyProps) {
  const [activeView, setActiveView] = createSignal<'disassembly' | 'cfg'>('disassembly');
  const [selectedFunction, setSelectedFunction] = createSignal<number | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [offset, setOffset] = createSignal<string>('0');
  const [length, setLength] = createSignal<string>('100');
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  const handleAddressClick = (address: number) => {
    setSelectedFunction(address);
    setActiveView('cfg');
  };

  // Assembly statistics - populated from backend
  const [asmStats, setAsmStats] = createSignal({
    functions: '0',
    instructions: '0',
    imports: '0',
    strings: '0'
  });

  const [functions, setFunctions] = createSignal<FunctionInfo[]>([]);

  // Load disassembly with offset/length support
  const loadDisassembly = async () => {
    const filePath = props.filePath || analysisStore.currentFile?.path;
    if (!filePath) return;

    setIsLoading(true);
    try {
      // Parse offset and length from inputs
      const offsetValue = parseInt(offset(), 10);
      const lengthValue = parseInt(length(), 10);

      // Build command parameters
      const params: {
        filePath: string;
        offset?: number;
        length?: number;
      } = { filePath };

      // Only include offset/length if they're valid and non-default
      if (!isNaN(offsetValue) && offsetValue > 0) {
        params.offset = offsetValue;
      }
      if (!isNaN(lengthValue) && lengthValue > 0 && lengthValue !== 100) {
        params.length = lengthValue;
      }

      // Get disassembly statistics from backend
      const result = await invokeCommand<DisassemblyResult>('disassemble_file', params);

      if (result) {
        // Update stats from real data
        setAsmStats({
          functions: result.functions?.length?.toString() || '0',
          instructions: formatNumber(result.instruction_count || result.instructions?.length || 0),
          imports: result.imports?.length?.toString() || '0',
          strings: result.strings?.length?.toString() || '0'
        });

        // Update function list from real data
        if (result.functions && Array.isArray(result.functions)) {
          setFunctions(result.functions.map((fn) => ({
            name: fn.name || 'unknown',
            address: `0x${(fn.address || 0).toString(16)}`,
            size: `0x${(fn.size || 0).toString(16)}`,
            type: classifyFunction(fn.name || '')
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load disassembly:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch disassembly data when file changes
  createEffect(() => {
    const filePath = props.filePath || analysisStore.currentFile?.path;
    if (filePath) {
      loadDisassembly();
    }
  });

  // Format large numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Classify function type based on name
  const classifyFunction = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('main') || lower.includes('start') || lower.includes('entry')) return 'entry';
    if (lower.includes('decrypt') || lower.includes('encode') || lower.includes('crypt')) return 'suspicious';
    if (lower.includes('debug') || lower.includes('check') || lower.includes('anti')) return 'anti-debug';
    if (lower.includes('socket') || lower.includes('connect') || lower.includes('http') || lower.includes('send')) return 'network';
    return 'normal';
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🔬 Binary Disassembly & Analysis
      </h2>
      
      {/* Assembly Statistics */}
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
        <StatCard 
          label="Functions" 
          value={asmStats().functions} 
        />
        <StatCard 
          label="Instructions" 
          value={asmStats().instructions} 
        />
        <StatCard 
          label="Imports" 
          value={asmStats().imports} 
        />
        <StatCard 
          label="Strings" 
          value={asmStats().strings} 
        />
      </div>

      <Show when={!props.filePath}>
        <div style="text-align: center; padding: 60px 20px; background: var(--panel-bg); border-radius: 12px; border: 2px dotted var(--barbie-pink);">
          <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
          <p style="font-size: 1.2rem; margin-bottom: 10px;">No file selected for analysis</p>
          <p style="color: var(--text-secondary);">Upload a binary file to begin disassembly</p>
        </div>
      </Show>

      <Show when={props.filePath}>
        {/* Advanced Controls */}
        <div style="margin-bottom: 20px;">
          <button
            class="btn btn-secondary"
            onClick={() => setShowAdvanced(!showAdvanced())}
            style="margin-bottom: 10px;"
          >
            {showAdvanced() ? '▼' : '▶'} Advanced Options
          </button>

          <Show when={showAdvanced()}>
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: end;">
              <div>
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary);">
                  Offset (bytes)
                </label>
                <input
                  type="number"
                  value={offset()}
                  onInput={(e) => setOffset(e.currentTarget.value)}
                  placeholder="0"
                  min="0"
                  style="width: 100%; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary);">
                  Max Instructions
                </label>
                <input
                  type="number"
                  value={length()}
                  onInput={(e) => setLength(e.currentTarget.value)}
                  placeholder="100"
                  min="1"
                  max="10000"
                  style="width: 100%; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
                />
              </div>
              <button
                class="btn btn-primary"
                onClick={loadDisassembly}
                disabled={isLoading()}
              >
                {isLoading() ? 'Loading...' : '🔄 Reload'}
              </button>
            </div>
          </Show>
        </div>

        <div class="analysis-grid">
          <div class="analysis-main">
            <AnalysisPanel
              title={activeView() === 'disassembly' ? 'Assembly View' : 'Control Flow Graph'}
              icon={activeView() === 'disassembly' ? '📋' : '🌐'}
              actions={
                <div class="view-toggle">
                  <button
                    class={`view-btn ${activeView() === 'disassembly' ? 'active' : ''}`}
                    onClick={() => setActiveView('disassembly')}
                  >
                    📋 Disassembly
                  </button>
                  <button
                    class={`view-btn ${activeView() === 'cfg' ? 'active' : ''}`}
                    onClick={() => setActiveView('cfg')}
                    disabled={!selectedFunction()}
                  >
                    🌐 CFG
                  </button>
                </div>
              }
            >
              <Show when={activeView() === 'disassembly'}>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px; min-height: 500px;">
                  <DisassemblyViewer 
                    filePath={props.filePath!} 
                    onAddressClick={handleAddressClick}
                  />
                </div>
              </Show>
              
              <Show when={activeView() === 'cfg' && selectedFunction()}>
                <div>
                  <div style="background: rgba(255, 182, 193, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0;">
                      Control Flow Graph for function at <code style="color: var(--barbie-pink);">{`0x${selectedFunction()!.toString(16)}`}</code>
                    </p>
                  </div>
                  <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px; min-height: 450px;">
                    <ControlFlowGraph 
                      filePath={props.filePath!} 
                      functionAddress={selectedFunction()!}
                    />
                  </div>
                </div>
              </Show>
            </AnalysisPanel>
          </div>
          
          <div class="ensemble-results">
            <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
              🎯 Function Analysis
            </h3>
            
            {/* Function List */}
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="margin-bottom: 10px;">📦 Key Functions</h4>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                <For each={functions()}>
                  {(func) => (
                    <div 
                      style="padding: 10px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 6px; cursor: pointer; transition: all 0.2s;"
                      onClick={() => {
                        setSelectedFunction(parseInt(func.address, 16));
                        setActiveView('cfg');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                    >
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--barbie-pink); font-weight: 600;">{func.name}</span>
                        <span style="color: var(--text-secondary);">{func.size}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                        <span>{func.address}</span>
                        <span class={`tag tag-${func.type}`} style={{
                          padding: '2px 8px',
                          'border-radius': '4px',
                          background: func.type === 'suspicious' ? 'rgba(255, 107, 107, 0.2)' : 
                                     func.type === 'anti-debug' ? 'rgba(255, 221, 61, 0.2)' :
                                     func.type === 'network' ? 'rgba(78, 205, 196, 0.2)' :
                                     'rgba(167, 139, 250, 0.2)',
                          color: func.type === 'suspicious' ? 'var(--danger-color)' : 
                                 func.type === 'anti-debug' ? 'var(--warning-color)' :
                                 func.type === 'network' ? 'var(--success-color)' :
                                 'var(--accent-color)'
                        }}>{func.type}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Analysis Actions */}
            <div class="artifacts-grid">
              <button class="btn btn-primary">🔍 Find Cryptor</button>
              <button class="btn btn-primary">🛡️ Anti-Debug</button>
              <button class="btn btn-secondary">📊 Strings</button>
              <button class="btn btn-secondary">📝 Export ASM</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}