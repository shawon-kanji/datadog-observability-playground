/**
 * Admin routes for user management
 */
import { Router, Request, Response, type IRouter } from 'express';
import { User, UserRole } from '../models/User';
import { logger } from '../logger';
import { authenticate, requireRole } from '../middleware/auth';

const router: IRouter = Router();

// All admin routes require ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

/**
 * GET /api/admin/users - Get all users
 * Query params: role (USER|MERCHANT|ADMIN)
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    logger.info('Admin fetching users', { role });

    const filter: any = {};
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching users', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/admin/users/:id - Get user by ID
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Admin fetching user', { userId: id });

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user', error as Error, { userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

/**
 * PUT /api/admin/users/:id/role - Update user role
 * Body: { role: 'USER' | 'MERCHANT' | 'ADMIN' }
 */
router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    logger.info('Admin updating user role', { userId: id, newRole: role });

    // Validate role
    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        validRoles: Object.values(UserRole)
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    logger.info('User role updated successfully', {
      userId: id,
      email: user.email,
      oldRole,
      newRole: role,
      updatedBy: (req as any).userId
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        oldRole
      }
    });
  } catch (error) {
    logger.error('Error updating user role', error as Error, { userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

/**
 * DELETE /api/admin/users/:id - Delete user
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    logger.info('Admin deleting user', { userId: id, adminId });

    // Prevent admin from deleting themselves
    if (id === adminId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info('User deleted successfully', {
      deletedUserId: id,
      deletedUserEmail: user.email,
      deletedBy: adminId
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    logger.error('Error deleting user', error as Error, { userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

/**
 * GET /api/admin/stats - Get user statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    logger.info('Admin fetching stats');

    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching stats', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

export default router;
