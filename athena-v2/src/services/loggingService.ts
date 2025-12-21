export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: any;
}

class LoggingService {
  private isDev = import.meta.env.DEV;

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  info(message: string, data?: any): void {
    if (this.isDev) {
      console.log(this.formatMessage('info', message), data || '');
    }
    // In production, send to logging service
    this.sendToLoggingService({ level: 'info', message, data });
  }

  warn(message: string, data?: any): void {
    if (this.isDev) {
      console.warn(this.formatMessage('warn', message), data || '');
    }
    this.sendToLoggingService({ level: 'warn', message, data });
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage('error', message), error || '');
    // Always log errors, even in production
    this.sendToLoggingService({ level: 'error', message, error });
    
    // Send to error tracking service
    this.sendToErrorTracking(message, error);
  }

  debug(message: string, data?: any): void {
    if (this.isDev) {
      console.log(this.formatMessage('debug', message), data || '');
    }
  }

  private sendToLoggingService(logData: Partial<LogData>): void {
    const fullLogData: LogData = {
      timestamp: new Date().toISOString(),
      level: logData.level || 'info',
      message: logData.message || '',
      data: logData.data,
      error: logData.error
    };

    // In production, send to backend via Tauri IPC for file-based logging
    // Per DeepWiki: localStorage is not appropriate for desktop app logging
    if (!this.isDev) {
      // Use Tauri's invoke to send logs to backend for persistent storage
      // Backend should use app_log_dir() for proper log file location
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('log_frontend_message', {
          level: fullLogData.level,
          message: fullLogData.message,
          data: fullLogData.data,
          timestamp: fullLogData.timestamp
        }).catch(() => {
          // Fail silently if backend is unavailable
        });
      }).catch(() => {
        // Fail silently if Tauri API is unavailable
      });
    }
  }

  private sendToErrorTracking(message: string, error?: any): void {
    // Send critical errors to backend for persistent logging
    // Per DeepWiki: Use Tauri IPC to forward errors to backend
    if (!this.isDev && error) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('log_frontend_error', {
          message,
          error: error?.toString() || String(error),
          stack: error?.stack,
          timestamp: new Date().toISOString()
        }).catch(() => {
          // Fail silently if backend is unavailable
        });
      }).catch(() => {
        // Fail silently if Tauri API is unavailable
      });
    }
  }

  // Methods removed: getLogs() and clearLogs()
  // Per DeepWiki: localStorage is not appropriate for desktop app logging
  // Logs are now stored on backend using Tauri's app_log_dir()
}

export const logger = new LoggingService();