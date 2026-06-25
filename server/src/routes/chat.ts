import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/workspace/:workspaceId', validate(schemas.pagination, 'query'), chatController.getMessages);
router.post('/workspace/:workspaceId', validate(schemas.sendMessage), chatController.sendMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.post('/messages/:messageId/reactions', chatController.addReaction);
router.delete('/messages/:messageId/reactions', chatController.removeReaction);

export default router;
