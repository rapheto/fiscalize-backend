import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
// Created by AI.
router.post('/2fa/verify', authController.verifyOtp);
router.post('/2fa/request-critical', authenticate, authController.requestCriticalOtp);
// Created by AI.
router.post('/refresh', authController.refresh);
// Updated by AI.
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
// Created by AI.
router.put('/me', authenticate, authController.updateMe);
// Created by AI.
router.patch('/me/password', authenticate, authController.changePassword);
// Created by AI.
// Created by AI.
router.post('/me/export', authenticate, authController.exportMe);
router.get('/me/export', authenticate, authController.exportMe);
// Created by AI.
router.delete('/me', authenticate, authController.deleteMe);
// Created by AI.
router.patch('/me/anonymization', authenticate, authController.setAnonymization);

export default router;