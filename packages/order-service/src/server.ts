import app from './app';
import { logger } from './logger';
import { Database } from './config/database';

const PORT = process.env.PORT || 3001;

// Connect to database and start server
async function startServer() {
  try {
    // Connect to MongoDB
    const db = Database.getInstance();
    await db.connect();
    logger.info('Connected to MongoDB');

    // Start Express server
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
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(async () => {
        logger.info('Server closed');

        // Disconnect from database
        await db.disconnect();
        logger.info('Database disconnected');

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
