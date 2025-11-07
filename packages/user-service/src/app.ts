// Initialize Datadog tracer first (must be before other imports)
import './tracer';

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import { logger } from './logger';
import authRoutes from './routes/auth';
import { database } from './config/database';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      userId: (req as any).userId || 'anonymous',
    });
  });

  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: process.env.DD_SERVICE || 'user-service',
    version: process.env.DD_VERSION || '1.0.0',
    database: database.getConnectionStatus() ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

export default app;
