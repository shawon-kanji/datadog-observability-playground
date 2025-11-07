import app from './app';
import { logger } from './logger';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    env: process.env.DD_ENV || 'development',
    service: process.env.DD_SERVICE || 'order-service',
    version: process.env.DD_VERSION || '1.0.0',
    datadogEnabled: true
  });

  logger.info(`Order service is running on port ${PORT}`);
  logger.info('Datadog APM is enabled');
  logger.info('Available scenarios (add as query parameter)');
  logger.info('  - ?scenario=error          (400 Bad Request)');
  logger.info('  - ?scenario=internal-error (500 Internal Error)');
  logger.info('  - ?scenario=long-latency   (5 second delay)');
  logger.info('  - ?scenario=random-latency (random 100ms-3s delay)');
  logger.info('  - ?scenario=timeout        (30 second delay)');
  logger.info('  - ?scenario=normal         (no delay)');
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
