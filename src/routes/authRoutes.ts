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

export default router;