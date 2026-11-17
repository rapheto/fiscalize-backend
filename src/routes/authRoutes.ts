import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
// Created by AI.
import {
  authenticationRateLimiter,
  otpRateLimiter,
} from '../middlewares/rateLimitMiddleware';
// Created by AI.
import { validate } from '../middlewares/validate';
// Created by AI.
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateMeSchema,
} from '../validators/authSchemas';

const router = Router();

// Updated by AI.
// Updated by AI.
router.post('/register', authenticationRateLimiter, validate(registerSchema), authController.register);
// Updated by AI.
// Updated by AI.
router.post('/login', authenticationRateLimiter, validate(loginSchema), authController.login);
// Created by AI.
router.post('/2fa/verify', otpRateLimiter, authController.verifyOtp);
router.post(
  '/2fa/request-critical',
  otpRateLimiter,
  authenticate,
  authController.requestCriticalOtp
);
// Created by AI.
// Updated by AI.
router.post('/refresh', authenticationRateLimiter, validate(refreshTokenSchema), authController.refresh);
// Updated by AI.
// Updated by AI.
router.post('/logout', authenticate, validate(refreshTokenSchema), authController.logout);
router.get('/me', authenticate, authController.me);
// Created by AI.
// Updated by AI.
router.put('/me', authenticate, validate(updateMeSchema), authController.updateMe);
// Created by AI.
// Updated by AI.
router.patch('/me/password', authenticate, validate(changePasswordSchema), authController.changePassword);
// Created by AI.
// Created by AI.
router.post('/me/export', authenticate, authController.exportMe);
router.get('/me/export', authenticate, authController.exportMe);
// Created by AI.
router.delete('/me', authenticate, authController.deleteMe);
// Created by AI.
router.patch('/me/anonymization', authenticate, authController.setAnonymization);

export default router;