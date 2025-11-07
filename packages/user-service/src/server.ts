import app from './app';
import { logger } from './logger';
import { database } from './config/database';

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    // Connect to MongoDB
    await database.connect();

    const server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        env: process.env.DD_ENV || 'development',
        service: process.env.DD_SERVICE || 'user-service',
        version: process.env.DD_VERSION || '1.0.0',
        datadogEnabled: true,
        mongodbConnected: database.getConnectionStatus(),
      });

      logger.info(`User service is running on port ${PORT}`);
      logger.info('Datadog APM is enabled');
      logger.info('MongoDB connection established');
      logger.info('Available endpoints:');
      logger.info('  - POST /api/auth/register (Register new user)');
      logger.info('  - POST /api/auth/login (Login user)');
      logger.info('  - GET /api/auth/me (Get current user - requires auth)');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(async () => {
        logger.info('Server closed');

        // Disconnect from MongoDB
        await database.disconnect();

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
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();
