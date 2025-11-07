/**
 * MongoDB connection configuration
 */
import mongoose from 'mongoose';
import { logger } from '../logger';

export class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user-service';

    try {
      await mongoose.connect(mongoUri);
      this.isConnected = true;
      logger.info('MongoDB connected successfully', { uri: mongoUri.replace(/\/\/.*@/, '//***@') });

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });
    } catch (error) {
      logger.error('Failed to connect to MongoDB', error as Error, { uri: mongoUri });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from MongoDB', error as Error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const database = Database.getInstance();
