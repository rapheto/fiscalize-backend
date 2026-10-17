import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
// Created by AI.
router.post('/refresh', authController.refresh);
// Updated by AI.
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
// Created by AI.
router.put('/me', authenticate, authController.updateMe);
// Created by AI.
router.get('/me/export', authenticate, authController.exportMe);
// Created by AI.
router.delete('/me', authenticate, authController.deleteMe);

export default router;