/**
 * Standardized application logger
 * Outputs JSON-formatted logs to stdout with trace context for APM correlation
 */
import pino from 'pino';
import tracer from 'dd-trace';

class Logger {
  private pinoLogger: pino.Logger;

  constructor() {
    const service = process.env.DD_SERVICE || 'order-service';
    const env = process.env.DD_ENV || 'development';

    this.pinoLogger = pino({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      base: {
        service,
        env,
      },
      mixin: () => this.getTraceContext(),
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  /**
   * Get current trace context from dd-trace
   * This enables log-trace correlation in APM platforms
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

  info(message: string, context?: any) {
    this.pinoLogger.info(context || {}, message);
  }

  warn(message: string, context?: any) {
    this.pinoLogger.warn(context || {}, message);
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

    this.pinoLogger.error(errorContext, message);
  }

  debug(message: string, context?: any) {
    this.pinoLogger.debug(context || {}, message);
  }
}

export const logger = new Logger();
