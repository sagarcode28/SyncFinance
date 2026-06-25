import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate, loadFullUser } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// Public routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, loadFullUser, authController.me);
router.patch(
  '/me',
  authenticate,
  validate(schemas.updateProfile),
  authController.updateProfile
);
router.post(
  '/change-password',
  authenticate,
  validate(schemas.changePassword),
  authController.changePassword
);

export default router;
