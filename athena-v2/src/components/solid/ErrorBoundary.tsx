import { Component, ErrorBoundary as SolidErrorBoundary, JSX, createSignal } from 'solid-js';
import { logger } from '../../services/loggingService';
import './ErrorBoundary.css';

interface ErrorInfo {
  error: Error;
  timestamp: Date;
  componentStack?: string;
  retryCount: number;
}

interface Props {
  children: JSX.Element;
  onError?: (error: Error, errorInfo: any) => void;
  fallbackComponent?: Component<{ error: Error; reset: () => void }>;
}

const DefaultErrorFallback: Component<{ error: Error; reset: () => void }> = (props) => {
  const [showDetails, setShowDetails] = createSignal(false);
  
  return (
    <div class="error-boundary-fallback">
      <div class="error-icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p class="error-message">{props.error.message || 'An unexpected error occurred'}</p>
      
      <div class="error-actions">
        <button class="btn-error-reset" onClick={props.reset}>
          Try Again
        </button>
        <button 
          class="btn-error-details" 
          onClick={() => setShowDetails(!showDetails())}
        >
          {showDetails() ? 'Hide' : 'Show'} Details
        </button>
      </div>
      
      {showDetails() && (
        <div class="error-details">
          <h3>Error Details</h3>
          <pre>{props.error.stack || props.error.toString()}</pre>
        </div>
      )}
    </div>
  );
};

export const ErrorBoundary: Component<Props> = (props) => {
  const [errorHistory, setErrorHistory] = createSignal<ErrorInfo[]>([]);
  const [retryCount, setRetryCount] = createSignal(0);
  
  const handleError = (error: Error, errorInfo: any) => {
    logger.error('Error caught by boundary:', { error, errorInfo });
    
    // Add to error history
    const newError: ErrorInfo = {
      error,
      timestamp: new Date(),
      componentStack: errorInfo?.componentStack,
      retryCount: retryCount(),
    };
    
    setErrorHistory(prev => [...prev, newError]);
    
    // Call parent error handler if provided
    if (props.onError) {
      props.onError(error, errorInfo);
    }
    
    // Log to performance monitor if available
    if (window.performanceMonitor) {
      window.performanceMonitor.recordMetric('error_boundary_triggered', 1, 'count');
    }
  };
  
  const reset = () => {
    setRetryCount(prev => prev + 1);
    setErrorHistory([]);
  };
  
  const FallbackComponent = props.fallbackComponent || DefaultErrorFallback;
  
  return (
    <SolidErrorBoundary
      fallback={(error, resetFn) => {
        handleError(error, { componentStack: '' });
        return (
          <FallbackComponent 
            error={error} 
            reset={() => {
              reset();
              resetFn();
            }} 
          />
        );
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};

// Specific error boundary for WASM operations
export const WasmErrorBoundary: Component<{ children: JSX.Element }> = (props) => {
  const WasmErrorFallback: Component<{ error: Error; reset: () => void }> = (fallbackProps) => {
    const isMemoryError = fallbackProps.error.message.toLowerCase().includes('memory');
    const isModuleError = fallbackProps.error.message.toLowerCase().includes('module');
    
    return (
      <div class="wasm-error-fallback">
        <div class="error-icon">🚀</div>
        <h2>WASM Error</h2>
        
        {isMemoryError && (
          <div class="error-hint">
            <p>This appears to be a memory-related error.</p>
            <p>Try clearing some memory by closing unused modules or clearing the cache.</p>
          </div>
        )}
        
        {isModuleError && (
          <div class="error-hint">
            <p>Failed to load or execute WASM module.</p>
            <p>The module may be corrupted or incompatible.</p>
          </div>
        )}
        
        <p class="error-message">{fallbackProps.error.message}</p>
        
        <button class="btn-error-reset" onClick={fallbackProps.reset}>
          Retry Operation
        </button>
      </div>
    );
  };
  
  return (
    <ErrorBoundary 
      fallbackComponent={WasmErrorFallback}
      onError={(error) => {
        logger.error('WASM Error:', error);
        // Could send telemetry or notify user
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
};

// Analysis-specific error boundary
export const AnalysisErrorBoundary: Component<{ children: JSX.Element }> = (props) => {
  const AnalysisErrorFallback: Component<{ error: Error; reset: () => void }> = (fallbackProps) => {
    return (
      <div class="analysis-error-fallback">
        <div class="error-icon">🔍</div>
        <h2>Analysis Error</h2>
        <p>Failed to complete the analysis operation.</p>
        <p class="error-message">{fallbackProps.error.message}</p>
        
        <div class="error-suggestions">
          <h3>Suggestions:</h3>
          <ul>
            <li>Check if the file is valid and not corrupted</li>
            <li>Ensure you have sufficient memory available</li>
            <li>Try analyzing a smaller file</li>
          </ul>
        </div>
        
        <button class="btn-error-reset" onClick={fallbackProps.reset}>
          Try Again
        </button>
      </div>
    );
  };
  
  return (
    <ErrorBoundary 
      fallbackComponent={AnalysisErrorFallback}
      onError={(error) => {
        logger.error('Analysis Error:', error);
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
};

// Global window type extension
declare global {
  interface Window {
    performanceMonitor?: any;
  }
}