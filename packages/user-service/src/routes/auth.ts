/**
 * Authentication routes (register, login)
 */
import { Router, Request, Response, type IRouter } from 'express';
import { User, IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { logger } from '../logger';

const router: IRouter = Router();

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      logger.warn('Registration failed: Missing required fields', { email });
      return res.status(400).json({
        success: false,
        error: 'All fields are required (email, password, firstName, lastName)',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed: User already exists', { email });
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
    });

    const duration = Date.now() - startTime;
    logger.info('User registered successfully', {
      userId: String(user._id),
      email: user.email,
      duration: `${duration}ms`,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Registration error', error as Error, { duration: `${duration}ms` });

    // Handle mongoose validation errors
    if ((error as any).name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: (error as any).message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      logger.warn('Login failed: Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user by email (include password field)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn('Login failed: User not found', { email });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password', { email, userId: String(user._id) });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
    });

    const duration = Date.now() - startTime;
    logger.info('User logged in successfully', {
      userId: String(user._id),
      email: user.email,
      duration: `${duration}ms`,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Login error', error as Error, { duration: `${duration}ms` });

    res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

/**
 * Get current user profile (requires authentication)
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // The userId should be added by auth middleware
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
    });
  } catch (error) {
    logger.error('Get profile error', error as Error);

    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    });
  }
});

export default router;
