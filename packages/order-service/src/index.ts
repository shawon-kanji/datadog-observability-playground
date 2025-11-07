/**
 * Entry point for the order service
 * Loads environment variables first, then starts the server
 */
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Start the server (which will load the tracer)
import './server';
