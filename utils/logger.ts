/**
 * Simple logger utility
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  error(message: string, meta?: any) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }

  warn(message: string, meta?: any) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  info(message: string, meta?: any) {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, meta || '');
    }
  }

  debug(message: string, meta?: any) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }
}

export const logger = new Logger();