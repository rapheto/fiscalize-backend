import { Router } from 'express';
import { demandController } from '../controllers/demandController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
// Created by AI.
import { demandCreationRateLimiter } from '../middlewares/rateLimitMiddleware';

const router = Router();

router.get('/', authenticate, demandController.list);
// Updated by AI.
router.get('/organizations', authenticate, demandController.listOrganizations);
// Created by AI.
router.get('/public', demandController.listPublic);
// Updated by AI.
router.post(
  '/',
  demandCreationRateLimiter,
  authenticate,
  requireRole(['Cidadao']),
  demandController.create
);
router.get('/:id', authenticate, demandController.getById);
router.put('/:id', authenticate, requireRole(['Cidadao']), demandController.update);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(['Gestor']),
  demandController.updateStatus
);

// Created by AI.
// Updated by AI.
// The owner (Cidadao) or a Gestor may delete — the ownership check itself
// lives in demandService.deleteDemand, since it needs the demand's row.
router.delete('/:id', authenticate, demandController.delete);

export default router;
