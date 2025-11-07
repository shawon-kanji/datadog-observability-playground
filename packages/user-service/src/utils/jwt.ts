/**
 * JWT utility functions for token generation and verification
 */
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: TokenPayload): string {
  try {
    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    logger.debug('JWT token generated', { userId: payload.userId, email: payload.email });
    return token;
  } catch (error) {
    logger.error('Failed to generate JWT token', error as Error, { userId: payload.userId });
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message });
      throw new Error('Invalid authentication token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token');
      throw new Error('Authentication token has expired');
    }
    logger.error('Failed to verify JWT token', error as Error);
    throw new Error('Failed to verify authentication token');
  }
}

/**
 * Decode a JWT token without verification (useful for debugging)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch (error) {
    logger.error('Failed to decode JWT token', error as Error);
    return null;
  }
}
