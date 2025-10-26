/**
 * Custom logger with Datadog integration
 * Logs are automatically enriched with trace context
 */

interface LogLevel {
  INFO: string;
  WARN: string;
  ERROR: string;
  DEBUG: string;
}

const LOG_LEVELS: LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug'
};

class Logger {
  private service: string;
  private env: string;

  constructor() {
    this.service = process.env.DD_SERVICE || 'test-datadog-crud-api';
    this.env = process.env.DD_ENV || 'development';
  }

  private formatLog(level: string, message: string, context?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      env: this.env,
      message,
      ...(context && { context })
    };

    return JSON.stringify(logEntry);
  }

  info(message: string, context?: any) {
    console.log(this.formatLog(LOG_LEVELS.INFO, message, context));
  }

  warn(message: string, context?: any) {
    console.warn(this.formatLog(LOG_LEVELS.WARN, message, context));
  }

  error(message: string, error?: Error, context?: any) {
    const errorContext = {
      ...context,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      })
    };

    console.error(this.formatLog(LOG_LEVELS.ERROR, message, errorContext));
  }

  debug(message: string, context?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog(LOG_LEVELS.DEBUG, message, context));
    }
  }
}

export const logger = new Logger();
