import { Component, Show, createMemo, onMount } from 'solid-js';
import { logger } from '../../../services/loggingService';

interface LazyPanelProps {
  name: string;
  isActive: boolean;
  shouldLoad: boolean;
  children: any;
}

export const LazyPanel: Component<LazyPanelProps> = (props) => {
  onMount(() => {
    if (props.shouldLoad) {
      logger.debug(`Lazy loading panel: ${props.name}`);
    }
  });

  return (
    <div class={`content-panel-container ${props.isActive ? 'active' : ''}`}>
      <Show when={props.shouldLoad}>
        {props.children}
      </Show>
    </div>
  );
};