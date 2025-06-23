import { createSignal, Show, For } from 'solid-js';
import DisassemblyViewer from '../visualization/DisassemblyViewer';
import ControlFlowGraph from '../visualization/ControlFlowGraph';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './Disassembly.css';

interface DisassemblyProps {
  filePath?: string;
}

export default function Disassembly(props: DisassemblyProps) {
  const [activeView, setActiveView] = createSignal<'disassembly' | 'cfg'>('disassembly');
  const [selectedFunction, setSelectedFunction] = createSignal<number | null>(null);

  const handleAddressClick = (address: number) => {
    setSelectedFunction(address);
    setActiveView('cfg');
  };

  // Mock assembly statistics
  const [asmStats] = createSignal({
    functions: '147',
    instructions: '12.4K',
    imports: '89',
    strings: '234'
  });

  const [functions] = createSignal([
    { name: 'main', address: '0x401000', size: '0x324', type: 'entry' },
    { name: 'decrypt_payload', address: '0x401324', size: '0x156', type: 'suspicious' },
    { name: 'check_debugger', address: '0x40147A', size: '0x87', type: 'anti-debug' },
    { name: 'network_connect', address: '0x401501', size: '0x1A2', type: 'network' }
  ]);

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