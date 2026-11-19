import { Router } from 'express';

import { notificationController } from '../controllers/notificationController';
import { authenticate } from '../middlewares/authMiddleware';

// Updated by AI.
const router = Router();

router.use(authenticate);
router.get('/preferences', notificationController.getPreferences);
router.patch('/preferences', notificationController.updatePreferences);
router.post('/test', notificationController.testPush);
router.post('/devices/push-token', notificationController.registerDevicePushToken);
router.get('/', notificationController.list);
router.patch('/:id/read', notificationController.markRead);

export default router;
