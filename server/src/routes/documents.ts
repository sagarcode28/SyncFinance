import { Router } from 'express';
import { documentController } from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.createDocument), documentController.create);
router.get('/workspace/:workspaceId', documentController.listByWorkspace);
router.get('/:id', validate(schemas.objectId, 'params'), documentController.getById);
router.delete('/:id', validate(schemas.objectId, 'params'), documentController.delete);

// Cell operations
router.patch('/:id/cells', validate(schemas.objectId, 'params'), validate(schemas.updateCell), documentController.updateCell);

// Row operations
router.post('/:id/rows', validate(schemas.objectId, 'params'), documentController.addRow);
router.delete('/:id/rows', validate(schemas.objectId, 'params'), documentController.deleteRow);

// Version management
router.post('/:id/versions', validate(schemas.objectId, 'params'), documentController.saveVersion);
router.post('/:id/versions/:versionId/restore', documentController.restoreVersion);

export default router;
