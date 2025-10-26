/**
 * Improved logger with proper Datadog trace correlation
 * Logs include trace_id and span_id for correlation with APM
 */
import tracer from 'dd-trace';

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

class DatadogLogger {
  private service: string;
  private env: string;

  constructor() {
    this.service = process.env.DD_SERVICE || 'test-datadog-crud-api';
    this.env = process.env.DD_ENV || 'development';
  }

  /**
   * Get current trace context from dd-trace
   * This enables log-trace correlation in Datadog
   */
  private getTraceContext() {
    const span = tracer.scope().active();
    if (span) {
      const spanContext = span.context();
      return {
        dd: {
          trace_id: spanContext.toTraceId(),
          span_id: spanContext.toSpanId(),
        }
      };
    }
    return {};
  }

  private formatLog(level: string, message: string, context?: any) {
    const traceContext = this.getTraceContext();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      env: this.env,
      message,
      ...traceContext, // Add trace_id and span_id
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

export const logger = new DatadogLogger();
