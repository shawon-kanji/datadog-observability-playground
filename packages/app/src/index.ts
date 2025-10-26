/**
 * Entry point for the application
 * Loads environment variables first, then starts the server
 */
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Start the server (which will load the tracer)
import './server';
