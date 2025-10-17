import { Component, createSignal, createEffect, For, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import './HexEditor.css';

interface HexEditorProps {
  data: Uint8Array;
  onDataChange?: (offset: number, value: number) => void;
  readOnly?: boolean;
}

interface HexRow {
  offset: number;
  bytes: (number | null)[];
  ascii: string[];
}

const HexEditor: Component<HexEditorProps> = (props) => {
  const BYTES_PER_ROW = 16;
  const [selectedOffset, setSelectedOffset] = createSignal<number | null>(null);
  const [editingOffset, setEditingOffset] = createSignal<number | null>(null);
  const [editValue, setEditValue] = createSignal('');
  const [rows, setRows] = createStore<HexRow[]>([]);
  const [visibleRange, setVisibleRange] = createSignal({ start: 0, end: 50 });
  
  let containerRef: HTMLDivElement | undefined;

  const processData = () => {
    const data = props.data;
    const newRows: HexRow[] = [];
    
    for (let i = 0; i < data.length; i += BYTES_PER_ROW) {
      const bytes: (number | null)[] = [];
      const ascii: string[] = [];
      
      for (let j = 0; j < BYTES_PER_ROW; j++) {
        const idx = i + j;
        if (idx < data.length) {
          const byte = data[idx];
          if (byte !== undefined) {
            bytes.push(byte);
            ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
          } else {
            bytes.push(null);
            ascii.push('');
          }
        } else {
          bytes.push(null);
          ascii.push('');
        }
      }
      
      newRows.push({
        offset: i,
        bytes,
        ascii
      });
    }
    
    setRows(newRows);
  };

  createEffect(() => {
    processData();
  });

  const handleByteClick = (offset: number) => {
    if (props.readOnly) return;
    const byte = props.data[offset];
    if (byte !== undefined) {
      setSelectedOffset(offset);
      setEditingOffset(offset);
      setEditValue(byte.toString(16).padStart(2, '0'));
    }
  };

  const handleEditSubmit = () => {
    const offset = editingOffset();
    if (offset === null || !editValue()) return;
    
    const value = parseInt(editValue(), 16);
    if (!isNaN(value) && value >= 0 && value <= 255) {
      props.onDataChange?.(offset, value);
      setEditingOffset(null);
      setEditValue('');
    }
  };

  const handleScroll = () => {
    if (!containerRef) return;
    
    const scrollTop = containerRef.scrollTop;
    const rowHeight = 24;
    const viewportHeight = containerRef.clientHeight;
    
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight);
    
    setVisibleRange({ start: startRow, end: endRow + 5 });
  };

  onMount(() => {
    if (containerRef) {
      containerRef.addEventListener('scroll', handleScroll);
      handleScroll();
    }
  });

  const formatOffset = (offset: number) => {
    return offset.toString(16).padStart(8, '0').toUpperCase();
  };

  const formatByte = (byte: number) => {
    return byte.toString(16).padStart(2, '0').toUpperCase();
  };

  return (
    <div class="hex-editor" ref={containerRef}>
      <div class="hex-header">
        <div class="hex-offset-header">Offset</div>
        <div class="hex-data-header">
          <For each={Array(BYTES_PER_ROW)}>
            {(_, i) => (
              <div class="hex-col-header">{i().toString(16).toUpperCase()}</div>
            )}
          </For>
        </div>
        <div class="hex-ascii-header">ASCII</div>
      </div>
      
      <div class="hex-body" style={{ height: `${rows.length * 24}px` }}>
        <For each={rows.slice(visibleRange().start, visibleRange().end)}>
          {(row) => (
            <div class="hex-row">
              <div class="hex-offset">{formatOffset(row.offset)}</div>
              <div class="hex-data">
                <For each={row.bytes}>
                  {(byte, i) => {
                    const offset = row.offset + i();
                    const isSelected = selectedOffset() === offset;
                    const isEditing = editingOffset() === offset;
                    
                    return (
                      <div
                        class="hex-byte"
                        classList={{
                          'selected': isSelected,
                          'editing': isEditing,
                          'empty': byte === null
                        }}
                        onClick={() => byte !== null && handleByteClick(offset)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            class="hex-edit-input"
                            value={editValue()}
                            onInput={(e) => setEditValue(e.currentTarget.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleEditSubmit()}
                            onBlur={handleEditSubmit}
                            maxLength={2}
                            autofocus
                          />
                        ) : (
                          byte !== null ? formatByte(byte) : ''
                        )}
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="hex-ascii">
                <For each={row.ascii}>
                  {(char) => (
                    <div class="hex-ascii-char">{char}</div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
      
      <div class="hex-status">
        {selectedOffset() !== null && (() => {
          const offset = selectedOffset()!;
          const byte = props.data[offset];
          return byte !== undefined ? (
            <span>
              Offset: {formatOffset(offset)} |
              Value: {formatByte(byte)} ({byte})
            </span>
          ) : null;
        })()}
      </div>
    </div>
  );
};

export default HexEditor;