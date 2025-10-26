/**
 * Datadog APM Tracer initialization
 * Must be imported and initialized before any other modules
 */
import tracer from 'dd-trace';

// Initialize the tracer
tracer.init({
  logInjection: true, // Inject trace IDs into logs
  runtimeMetrics: true, // Enable runtime metrics collection
  profiling: true, // Enable continuous profiling
  env: process.env.DD_ENV || 'development',
  service: process.env.DD_SERVICE || 'test-datadog-crud-api',
  version: process.env.DD_VERSION || '1.0.0',
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || '8126',
});

export default tracer;
