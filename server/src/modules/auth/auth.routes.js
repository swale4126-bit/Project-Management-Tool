import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.patch('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
