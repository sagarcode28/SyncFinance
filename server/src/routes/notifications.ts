import { Router, Response, NextFunction } from 'express';
import { Notification } from '../models/index.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get user's notifications
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = { userId: req.userId };
    if (unreadOnly === 'true') filter.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.userId, read: false }),
    ]);

    res.json({
      success: true,
      data: notifications,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' },
    });
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Notification deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
