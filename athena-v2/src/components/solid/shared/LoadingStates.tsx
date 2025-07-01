import { Component, Show, createSignal, For } from 'solid-js';
import './LoadingStates.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export const LoadingSpinner: Component<LoadingSpinnerProps> = (props) => {
  const sizeMap = {
    small: 20,
    medium: 40,
    large: 60
  };

  const size = sizeMap[props.size || 'medium'];

  return (
    <div 
      class="loading-spinner"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        'border-color': props.color || 'var(--barbie-pink)'
      }}
    />
  );
};

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rect' | 'circle';
  animation?: 'pulse' | 'wave';
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  return (
    <div 
      class={`skeleton skeleton-${props.variant || 'rect'} skeleton-${props.animation || 'pulse'}`}
      style={{
        width: props.width || '100%',
        height: props.height || '20px'
      }}
    />
  );
};

interface LoadingOverlayProps {
  message?: string;
  transparent?: boolean;
}

export const LoadingOverlay: Component<LoadingOverlayProps> = (props) => {
  return (
    <div class={`loading-overlay ${props.transparent ? 'transparent' : ''}`}>
      <div class="loading-content">
        <LoadingSpinner size="large" />
        <Show when={props.message}>
          <p class="loading-message">{props.message}</p>
        </Show>
      </div>
    </div>
  );
};

interface LoadingDotsProps {
  text?: string;
}

export const LoadingDots: Component<LoadingDotsProps> = (props) => {
  return (
    <span class="loading-dots">
      {props.text || 'Loading'}
      <span class="dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const percentage = () => (props.value / (props.max || 100)) * 100;

  return (
    <div class="progress-container">
      <Show when={props.label}>
        <div class="progress-label">{props.label}</div>
      </Show>
      <div class="progress-bar">
        <div 
          class="progress-fill"
          style={{
            width: `${percentage()}%`,
            background: props.color || 'var(--barbie-gradient)'
          }}
        />
      </div>
      <Show when={props.showPercentage}>
        <div class="progress-percentage">{percentage().toFixed(0)}%</div>
      </Show>
    </div>
  );
};

interface LoadingCardProps {
  lines?: number;
  showImage?: boolean;
}

export const LoadingCard: Component<LoadingCardProps> = (props) => {
  const lineCount = props.lines || 3;

  return (
    <div class="loading-card">
      <Show when={props.showImage}>
        <Skeleton variant="rect" width="100%" height="200px" />
      </Show>
      <div class="loading-card-content">
        <Skeleton variant="text" width="60%" height="24px" />
        <div style="margin-top: 12px;">
          <For each={Array(lineCount).fill(0)}>
            {(_, index) => (
              <Skeleton 
                variant="text" 
                width={index() === lineCount - 1 ? "80%" : "100%"} 
                height="16px"
                style="margin-bottom: 8px;"
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

// Global loading state manager
class LoadingStateManager {
  private loadingStates = new Map<string, boolean>();
  private subscribers = new Map<string, Set<() => void>>();

  setLoading(key: string, isLoading: boolean) {
    this.loadingStates.set(key, isLoading);
    this.notifySubscribers(key);
  }

  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  isAnyLoading(): boolean {
    return Array.from(this.loadingStates.values()).some(state => state);
  }

  subscribe(key: string, callback: () => void) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private notifySubscribers(key: string) {
    this.subscribers.get(key)?.forEach(callback => callback());
  }

  clear() {
    this.loadingStates.clear();
    this.subscribers.clear();
  }
}

export const loadingStateManager = new LoadingStateManager();

// Hook for using loading states
export function useLoadingState(key: string) {
  const [isLoading, setIsLoading] = createSignal(loadingStateManager.isLoading(key));

  const unsubscribe = loadingStateManager.subscribe(key, () => {
    setIsLoading(loadingStateManager.isLoading(key));
  });

  const setLoadingState = (loading: boolean) => {
    loadingStateManager.setLoading(key, loading);
  };

  return {
    isLoading,
    setLoading: setLoadingState,
    cleanup: unsubscribe
  };
}