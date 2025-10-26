import app from './app';
import { logger } from './logger';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    env: process.env.DD_ENV || 'development',
    service: process.env.DD_SERVICE || 'test-datadog-crud-api',
    version: process.env.DD_VERSION || '1.0.0',
    datadogEnabled: true
  });

  console.log(`\n🚀 Server is running on port ${PORT}`);
  console.log(`📊 Datadog APM is enabled`);
  console.log(`\nAvailable scenarios (add as query parameter):`);
  console.log(`  - ?scenario=error          (400 Bad Request)`);
  console.log(`  - ?scenario=internal-error (500 Internal Error)`);
  console.log(`  - ?scenario=long-latency   (5 second delay)`);
  console.log(`  - ?scenario=random-latency (random 100ms-3s delay)`);
  console.log(`  - ?scenario=timeout        (30 second delay)`);
  console.log(`  - ?scenario=normal         (no delay)\n`);
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
