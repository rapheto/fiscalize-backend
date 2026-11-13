import { Router } from 'express';

import { notificationController } from '../controllers/notificationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);
router.post('/devices/push-token', notificationController.registerDevicePushToken);
router.get('/', notificationController.list);
router.patch('/:id/read', notificationController.markRead);

export default router;
