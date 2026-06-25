import { Router } from 'express';
import authRoutes from './auth.js';
import workspaceRoutes from './workspaces.js';
import documentRoutes from './documents.js';
import chatRoutes from './chat.js';
import auditRoutes from './audit.js';
import notificationRoutes from './notifications.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/documents', documentRoutes);
router.use('/chat', chatRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationRoutes);

export default router;
