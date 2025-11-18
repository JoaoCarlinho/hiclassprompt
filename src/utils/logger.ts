/**
 * Logger utility
 * Simple console-based logger with log levels
 */

import type { LogLevel } from '../types';

/**
 * Logger class for structured logging
 */
class Logger {
  private level: LogLevel = 'info';
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: unknown): void {
    this.log('debug', message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: unknown): void {
    this.log('info', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: unknown): void {
    this.log('warn', message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, meta?: unknown): void {
    this.log('error', message, meta);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

      if (meta) {
        // eslint-disable-next-line no-console
        console.log(logMessage, meta);
      } else {
        // eslint-disable-next-line no-console
        console.log(logMessage);
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();
