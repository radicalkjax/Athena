import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface DisassemblyResult {
  instructions: Instruction[];
  functions: Function[];
  strings: ExtractedString[];
  entry_point: number | null;
  architecture: string;
  sections: Section[];
}

interface Instruction {
  address: number;
  bytes: string;
  mnemonic: string;
  operands: string;
  size: number;
  is_jump: boolean;
  is_call: boolean;
  jump_target: number | null;
}

interface Function {
  name: string;
  address: number;
  size: number;
  instructions_count: number;
  calls: string[];
}

interface ExtractedString {
  address: number;
  value: string;
  section: string;
}

interface Section {
  name: string;
  address: number;
  size: number;
  flags: string;
}

interface DisassemblyViewerProps {
  filePath: string;
  onAddressClick?: (address: number) => void;
}

export default function DisassemblyViewer(props: DisassemblyViewerProps) {
  const [disassembly, setDisassembly] = createSignal<DisassemblyResult | null>(null);
  const [selectedFunction, setSelectedFunction] = createSignal<Function | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>('');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [showStrings, setShowStrings] = createSignal(true);
  const [showFunctions, setShowFunctions] = createSignal(true);
  const [addressMap, setAddressMap] = createSignal<Map<number, number>>(new Map());

  const loadDisassembly = async () => {
    if (!props.filePath) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await invoke<DisassemblyResult>('disassemble_file', {
        filePath: props.filePath,
      });
      
      setDisassembly(result);
      
      // Build address to line mapping
      const map = new Map<number, number>();
      result.instructions.forEach((inst, index) => {
        map.set(inst.address, index);
      });
      setAddressMap(map);
      
      // Auto-select first function
      if (result.functions.length > 0) {
        setSelectedFunction(result.functions[0]);
      }
    } catch (err) {
      setError(`Failed to disassemble: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadDisassembly();
  });

  const formatAddress = (addr: number) => {
    return `0x${addr.toString(16).padStart(8, '0')}`;
  };

  const getInstructionColor = (inst: Instruction) => {
    if (inst.is_call) return '#ff6b9d';
    if (inst.is_jump) return '#c77dff';
    if (inst.mnemonic === 'ret' || inst.mnemonic === 'retn') return '#7209b7';
    if (inst.mnemonic.startsWith('push') || inst.mnemonic.startsWith('pop')) return '#f72585';
    if (inst.mnemonic.startsWith('mov')) return '#4cc9f0';
    return '#e0e0e0';
  };

  const filteredInstructions = createMemo(() => {
    const data = disassembly();
    if (!data) return [];
    
    const search = searchTerm().toLowerCase();
    if (!search) return data.instructions;
    
    return data.instructions.filter(inst => 
      inst.mnemonic.toLowerCase().includes(search) ||
      inst.operands.toLowerCase().includes(search) ||
      formatAddress(inst.address).includes(search)
    );
  });

  const jumpToAddress = (address: number) => {
    const map = addressMap();
    const index = map.get(address);
    if (index !== undefined) {
      const element = document.getElementById(`inst-${index}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('highlight');
      setTimeout(() => element?.classList.remove('highlight'), 2000);
    }
  };

  const jumpToFunction = (func: Function) => {
    setSelectedFunction(func);
    jumpToAddress(func.address);
  };

  return (
    <div class="disassembly-viewer">
      {loading() && (
        <div class="loading">Disassembling binary...</div>
      )}
      
      {error() && (
        <div class="error-message">{error()}</div>
      )}
      
      {disassembly() && (
        <div class="disassembly-content">
          <div class="disassembly-header">
            <div class="file-info">
              <h3>Disassembly View</h3>
              <div class="architecture">Architecture: {disassembly()!.architecture}</div>
              {disassembly()!.entry_point !== null && (
                <div class="entry-point">
                  Entry Point: {formatAddress(disassembly()!.entry_point)}
                  <button
                    class="jump-btn"
                    onClick={() => {
                      const entryPoint = disassembly()!.entry_point;
                      if (entryPoint !== null) jumpToAddress(entryPoint);
                    }}
                  >
                    Jump
                  </button>
                </div>
              )}
            </div>
            
            <div class="search-bar">
              <input
                type="text"
                placeholder="Search instructions..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
              />
            </div>
            
            <div class="view-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={showFunctions()}
                  onChange={(e) => setShowFunctions(e.currentTarget.checked)}
                />
                Functions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showStrings()}
                  onChange={(e) => setShowStrings(e.currentTarget.checked)}
                />
                Strings
              </label>
            </div>
          </div>

          <div class="disassembly-layout">
            <div class="sidebar">
              <Show when={showFunctions()}>
                <div class="functions-panel">
                  <h4>Functions ({disassembly()!.functions.length})</h4>
                  <div class="function-list">
                    <For each={disassembly()!.functions}>
                      {(func) => (
                        <div 
                          class="function-item"
                          classList={{ selected: selectedFunction()?.address === func.address }}
                          onClick={() => jumpToFunction(func)}
                        >
                          <div class="function-name">{func.name}</div>
                          <div class="function-details">
                            <span>{formatAddress(func.address)}</span>
                            <span>{func.instructions_count} instructions</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
              
              <Show when={showStrings()}>
                <div class="strings-panel">
                  <h4>Strings ({disassembly()!.strings.length})</h4>
                  <div class="string-list">
                    <For each={disassembly()!.strings.slice(0, 100)}>
                      {(str) => (
                        <div class="string-item">
                          <div class="string-address">{formatAddress(str.address)}</div>
                          <div class="string-value">{str.value}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            <div class="instructions-panel">
              <div class="instructions-header">
                <span class="col-address">Address</span>
                <span class="col-bytes">Bytes</span>
                <span class="col-mnemonic">Instruction</span>
                <span class="col-operands">Operands</span>
                <span class="col-comments">Comments</span>
              </div>
              
              <div class="instructions-list">
                <For each={filteredInstructions()}>
                  {(inst, index) => (
                    <div 
                      id={`inst-${index()}`}
                      class="instruction-row"
                      classList={{ 
                        'is-jump': inst.is_jump,
                        'is-call': inst.is_call 
                      }}
                    >
                      <span class="col-address">{formatAddress(inst.address)}</span>
                      <span class="col-bytes">{inst.bytes}</span>
                      <span 
                        class="col-mnemonic"
                        style={{ color: getInstructionColor(inst) }}
                      >
                        {inst.mnemonic}
                      </span>
                      <span class="col-operands">
                        {inst.operands}
                        {inst.jump_target && (
                          <button
                            class="inline-jump-btn"
                            onClick={() => jumpToAddress(inst.jump_target!)}
                            title={`Jump to ${formatAddress(inst.jump_target!)}`}
                          >
                            →
                          </button>
                        )}
                      </span>
                      <span class="col-comments">
                        {inst.is_call && 'Function call'}
                        {inst.is_jump && !inst.is_call && 'Jump'}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="sections-panel">
              <h4>Sections</h4>
              <div class="sections-list">
                <For each={disassembly()!.sections}>
                  {(section) => (
                    <div class="section-item">
                      <div class="section-name">{section.name}</div>
                      <div class="section-info">
                        <span>{formatAddress(section.address)}</span>
                        <span>Size: 0x{section.size.toString(16)}</span>
                      </div>
                      <div class="section-flags">Flags: {section.flags}</div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}