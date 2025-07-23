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

    // TODO: Implement actual logging service integration
    // For now, we'll store in localStorage for debugging
    if (!this.isDev) {
      try {
        const logs = JSON.parse(localStorage.getItem('athena_logs') || '[]');
        logs.push(fullLogData);
        // Keep only last 1000 logs
        if (logs.length > 1000) {
          logs.splice(0, logs.length - 1000);
        }
        localStorage.setItem('athena_logs', JSON.stringify(logs));
      } catch (e) {
        // Fail silently if localStorage is full or unavailable
      }
    }
  }

  private sendToErrorTracking(_message: string, error?: any): void {
    // TODO: Integrate with error tracking service (e.g., Sentry)
    // For now, just ensure critical errors are captured
    if (!this.isDev && error) {
      // Could integrate with Tauri's error reporting here
    }
  }

  // Method to retrieve logs (useful for debugging)
  getLogs(): LogData[] {
    try {
      return JSON.parse(localStorage.getItem('athena_logs') || '[]');
    } catch {
      return [];
    }
  }

  clearLogs(): void {
    localStorage.removeItem('athena_logs');
  }
}

export const logger = new LoggingService();