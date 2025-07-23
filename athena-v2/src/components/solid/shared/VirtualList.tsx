import { createSignal, onMount, onCleanup, For, createMemo, JSX } from 'solid-js';
import { performanceConfig } from '../../../config/performance';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => any;
  itemHeight?: number;
  overscan?: number;
  class?: string;
  threshold?: number;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  const itemHeight = props.itemHeight || performanceConfig.virtualScrolling.itemHeight;
  const overscan = props.overscan || performanceConfig.virtualScrolling.overscan;
  const threshold = props.threshold || performanceConfig.virtualScrolling.threshold;
  
  // Don't use virtual scrolling for small lists
  if (!performanceConfig.virtualScrolling.enabled || props.items.length < threshold) {
    return (
      <div class={props.class}>
        <For each={props.items}>
          {(item, index) => props.renderItem(item, index())}
        </For>
      </div>
    );
  }

  let containerRef: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(0);

  const visibleRange = createMemo(() => {
    const start = Math.floor(scrollTop() / itemHeight);
    const end = Math.ceil((scrollTop() + containerHeight()) / itemHeight);
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(props.items.length - 1, end + overscan)
    };
  });

  const visibleItems = createMemo(() => {
    const { start, end } = visibleRange();
    return props.items.slice(start, end + 1).map((item, i) => ({
      item,
      index: start + i,
      style: {
        position: 'absolute' as const,
        top: `${(start + i) * itemHeight}px`,
        height: `${itemHeight}px`,
        width: '100%'
      } as JSX.CSSProperties
    }));
  });

  const totalHeight = createMemo(() => props.items.length * itemHeight);

  const handleScroll = () => {
    if (containerRef) {
      setScrollTop(containerRef.scrollTop);
    }
  };

  const handleResize = () => {
    if (containerRef) {
      setContainerHeight(containerRef.clientHeight);
    }
  };

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
  });

  return (
    <div
      ref={containerRef!}
      class={`virtual-list-container ${props.class || ''}`}
      onScroll={handleScroll}
      style={{
        position: 'relative',
        overflow: 'auto',
        height: '100%'
      }}
    >
      <div style={{ height: `${totalHeight()}px`, position: 'relative' }}>
        <For each={visibleItems()}>
          {({ item, index, style }) => (
            <div style={style}>
              {props.renderItem(item, index)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}