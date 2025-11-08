/**
 * Authentication middleware to verify JWT tokens
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { logger } from '../logger';
import { UserRole } from '../models/User';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: UserRole;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Authentication failed: No authorization header', {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
      return;
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Authentication failed: Invalid authorization format', {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        error: 'Invalid authorization format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = verifyToken(token);

    // Attach user information to request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;

    logger.debug('Authentication successful', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      path: req.path,
      method: req.method,
      error: (error as Error).message,
    });
    res.status(401).json({
      success: false,
      error: (error as Error).message || 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];
    const decoded = verifyToken(token);

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;

    logger.debug('Optional authentication successful', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      path: req.path,
    });
  } catch (error) {
    // Silently continue without authentication
    logger.debug('Optional authentication skipped', { path: req.path });
  }

  next();
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.userRole;

    if (!userRole) {
      logger.warn('Authorization failed: No user role found', {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userRole,
        allowedRoles,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    logger.debug('Authorization successful', {
      userRole,
      allowedRoles,
      path: req.path,
    });

    next();
  };
}
