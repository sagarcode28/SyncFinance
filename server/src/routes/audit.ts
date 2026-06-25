import { Router, Response, NextFunction } from 'express';
import { AuditLog, Workspace, FinancialDoc } from '../models/index.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);

/**
 * Confirm the authenticated user belongs to the workspace before exposing any
 * audit data. Without this check anyone with a valid token can read every
 * workspace's history — a real data-leak vulnerability.
 */
async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const workspace = await Workspace.findById(workspaceId).select('members');
  if (!workspace) {
    throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  }
  const member = workspace.members.find((m: any) => m.userId === userId);
  if (!member) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }
}

// Get audit logs for a workspace
router.get('/workspace/:workspaceId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await requireWorkspaceMember(req.params.workspaceId, req.userId!);

    const { page = 1, limit = 50, action, resource } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId };
    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get audit logs for a specific document. Caller must be a member of the
// workspace that owns the document.
router.get('/document/:documentId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await FinancialDoc.findById(req.params.documentId).select('workspaceId');
    if (!doc) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }
    await requireWorkspaceMember(doc.workspaceId, req.userId!);

    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find({ resourceId: req.params.documentId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments({ resourceId: req.params.documentId }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
