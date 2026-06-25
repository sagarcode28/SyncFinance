import { Router } from 'express';
import { workspaceController } from '../controllers/workspaceController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.createWorkspace), workspaceController.create);
router.get('/', validate(schemas.pagination, 'query'), workspaceController.list);
router.get('/:id', validate(schemas.objectId, 'params'), workspaceController.getById);
router.patch('/:id', validate(schemas.objectId, 'params'), validate(schemas.updateWorkspace), workspaceController.update);
router.delete('/:id', validate(schemas.objectId, 'params'), workspaceController.delete);

// Member management
router.get('/:id/members', validate(schemas.objectId, 'params'), workspaceController.getMembers);
router.post('/:id/members', validate(schemas.objectId, 'params'), validate(schemas.inviteMember), workspaceController.inviteMember);
router.delete('/:id/members/:memberId', workspaceController.removeMember);
router.patch('/:id/members/:memberId', workspaceController.updateMemberRole);

export default router;
