import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import { invokeCommand } from '../../../utils/tauriCompat';

interface ControlFlowGraph {
  blocks: ControlFlowBlock[];
  entry_block: string;
}

interface ControlFlowBlock {
  id: string;
  start_address: number;
  end_address: number;
  instructions: Instruction[];
  successors: string[];
  predecessors: string[];
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

interface ControlFlowGraphProps {
  filePath: string;
  functionAddress: number;
}

interface BlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ControlFlowGraph(props: ControlFlowGraphProps) {
  const [cfg, setCfg] = createSignal<ControlFlowGraph | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>('');
  const [blockPositions, setBlockPositions] = createSignal<Map<string, BlockPosition>>(new Map());
  const [selectedBlock, setSelectedBlock] = createSignal<string | null>(null);
  const [zoomLevel, setZoomLevel] = createSignal(1);
  
  const BLOCK_WIDTH = 300;
  const BLOCK_MIN_HEIGHT = 100;
  const BLOCK_SPACING_X = 100;
  const BLOCK_SPACING_Y = 80;
  const INSTRUCTION_HEIGHT = 20;

  const loadCFG = async () => {
    if (!props.filePath || !props.functionAddress) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await invokeCommand('get_control_flow_graph', {
        filePath: props.filePath,
        functionAddress: props.functionAddress,
      }) as ControlFlowGraph;
      
      setCfg(result);
      layoutBlocks(result);
    } catch (err) {
      setError(`Failed to generate CFG: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const layoutBlocks = (graph: ControlFlowGraph) => {
    const positions = new Map<string, BlockPosition>();
    const visited = new Set<string>();
    const levels = new Map<string, number>();
    
    // BFS to determine levels
    const queue: [string, number][] = [[graph.entry_block, 0]];
    let maxLevel = 0;
    
    while (queue.length > 0) {
      const [blockId, level] = queue.shift()!;
      if (visited.has(blockId)) continue;
      
      visited.add(blockId);
      levels.set(blockId, level);
      maxLevel = Math.max(maxLevel, level);
      
      const block = graph.blocks.find(b => b.id === blockId);
      if (block) {
        for (const successor of block.successors) {
          if (!visited.has(successor)) {
            queue.push([successor, level + 1]);
          }
        }
      }
    }
    
    // Count blocks at each level
    const levelCounts = new Map<number, number>();
    for (let i = 0; i <= maxLevel; i++) {
      levelCounts.set(i, 0);
    }
    
    levels.forEach((level) => {
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    });
    
    // Position blocks
    const levelOffsets = new Map<number, number>();
    for (let i = 0; i <= maxLevel; i++) {
      levelOffsets.set(i, 0);
    }
    
    graph.blocks.forEach(block => {
      const level = levels.get(block.id) || 0;
      const offset = levelOffsets.get(level) || 0;
      const count = levelCounts.get(level) || 1;
      
      const height = Math.max(
        BLOCK_MIN_HEIGHT,
        40 + block.instructions.length * INSTRUCTION_HEIGHT
      );
      
      const totalWidth = count * BLOCK_WIDTH + (count - 1) * BLOCK_SPACING_X;
      const startX = -totalWidth / 2;
      
      positions.set(block.id, {
        x: startX + offset * (BLOCK_WIDTH + BLOCK_SPACING_X) + BLOCK_WIDTH / 2,
        y: level * (BLOCK_MIN_HEIGHT + BLOCK_SPACING_Y),
        width: BLOCK_WIDTH,
        height: height,
      });
      
      levelOffsets.set(level, offset + 1);
    });
    
    setBlockPositions(positions);
  };

  createEffect(() => {
    loadCFG();
  });

  const formatAddress = (addr: number) => {
    return `0x${addr.toString(16).padStart(8, '0')}`;
  };

  const getEdgePath = (fromId: string, toId: string) => {
    const positions = blockPositions();
    const from = positions.get(fromId);
    const to = positions.get(toId);
    
    if (!from || !to) return '';
    
    const fromX = from.x;
    const fromY = from.y + from.height;
    const toX = to.x;
    const toY = to.y;
    
    // Bezier curve for smoother edges
    const controlY = (fromY + toY) / 2;
    
    return `M ${fromX} ${fromY} Q ${fromX} ${controlY}, ${toX} ${toY}`;
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  return (
    <div class="cfg-viewer" onWheel={handleWheel}>
      {loading() && (
        <div class="loading">Generating control flow graph...</div>
      )}
      
      {error() && (
        <div class="error-message">{error()}</div>
      )}
      
      {cfg() && (
        <div class="cfg-content">
          <div class="cfg-controls">
            <button onClick={() => setZoomLevel(1)}>Reset Zoom</button>
            <span>Zoom: {(zoomLevel() * 100).toFixed(0)}%</span>
            <button onClick={() => setZoomLevel(prev => Math.min(3, prev * 1.1))}>+</button>
            <button onClick={() => setZoomLevel(prev => Math.max(0.1, prev * 0.9))}>-</button>
          </div>
          
          <svg class="cfg-canvas" width="100%" height="100%">
            <g transform={`scale(${zoomLevel()}) translate(400, 50)`}>
              {/* Draw edges first */}
              <For each={cfg()!.blocks}>
                {(block) => (
                  <For each={block.successors}>
                    {(successor) => {
                      const positions = blockPositions();
                      const isBackEdge = positions.get(successor)!.y <= positions.get(block.id)!.y;
                      return (
                        <path
                          d={getEdgePath(block.id, successor)}
                          fill="none"
                          stroke={isBackEdge ? '#ff6b9d' : '#c77dff'}
                          stroke-width="2"
                          marker-end="url(#arrowhead)"
                          class="cfg-edge"
                        />
                      );
                    }}
                  </For>
                )}
              </For>
              
              {/* Draw blocks */}
              <For each={cfg()!.blocks}>
                {(block) => {
                  const pos = blockPositions().get(block.id);
                  if (!pos) return null;
                  
                  return (
                    <g
                      transform={`translate(${pos.x - pos.width / 2}, ${pos.y})`}
                      class="cfg-block"
                      classList={{ selected: selectedBlock() === block.id }}
                      onClick={() => setSelectedBlock(block.id)}
                    >
                      <rect
                        width={pos.width}
                        height={pos.height}
                        fill="#2a2a2a"
                        stroke={block.id === cfg()!.entry_block ? '#ff6b9d' : '#444'}
                        stroke-width="2"
                        rx="4"
                      />
                      
                      <text x={pos.width / 2} y="20" text-anchor="middle" fill="#ff6b9d" font-weight="bold">
                        {block.id}
                      </text>
                      
                      <text x={pos.width / 2} y="35" text-anchor="middle" fill="#888" font-size="12">
                        {formatAddress(block.start_address)} - {formatAddress(block.end_address)}
                      </text>
                      
                      <g transform="translate(10, 50)">
                        <For each={block.instructions.slice(0, 5)}>
                          {(inst, index) => (
                            <text
                              y={index() * INSTRUCTION_HEIGHT}
                              fill="#e0e0e0"
                              font-family="monospace"
                              font-size="12"
                            >
                              {inst.mnemonic} {inst.operands}
                            </text>
                          )}
                        </For>
                        {block.instructions.length > 5 && (
                          <text
                            y={5 * INSTRUCTION_HEIGHT}
                            fill="#888"
                            font-size="12"
                          >
                            ... +{block.instructions.length - 5} more
                          </text>
                        )}
                      </g>
                    </g>
                  );
                }}
              </For>
            </g>
            
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#c77dff"
                />
              </marker>
            </defs>
          </svg>
          
          <Show when={selectedBlock()}>
            <div class="block-details">
              <h4>Block Details: {selectedBlock()}</h4>
              <div class="block-info">
                <div>Instructions: {cfg()!.blocks.find(b => b.id === selectedBlock())?.instructions.length}</div>
                <div>Predecessors: {cfg()!.blocks.find(b => b.id === selectedBlock())?.predecessors.join(', ') || 'None'}</div>
                <div>Successors: {cfg()!.blocks.find(b => b.id === selectedBlock())?.successors.join(', ') || 'None'}</div>
              </div>
              <div class="block-instructions">
                <For each={cfg()!.blocks.find(b => b.id === selectedBlock())?.instructions}>
                  {(inst) => (
                    <div class="cfg-instruction">
                      <span class="addr">{formatAddress(inst.address)}</span>
                      <span class="mnemonic">{inst.mnemonic}</span>
                      <span class="operands">{inst.operands}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      )}
    </div>
  );
}