import { Router } from 'express';
import { demandController } from '../controllers/demandController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
// Created by AI.
import { demandCreationRateLimiter } from '../middlewares/rateLimitMiddleware';
// Created by AI.
import { validate } from '../middlewares/validate';
// Created by AI.
import { demandSchema, demandStatusSchema } from '../validators/demandSchemas';

const router = Router();

router.get('/', authenticate, demandController.list);
// Updated by AI.
router.get('/organizations', authenticate, demandController.listOrganizations);
// Created by AI.
router.get('/public', demandController.listPublic);
// Updated by AI.
// Updated by AI.
router.post(
  '/',
  demandCreationRateLimiter,
  authenticate,
  requireRole(['Cidadao']),
  validate(demandSchema),
  demandController.create
);
router.get('/:id', authenticate, demandController.getById);
// Updated by AI.
router.put('/:id', authenticate, requireRole(['Cidadao']), validate(demandSchema), demandController.update);

// Updated by AI.
router.patch(
  '/:id/status',
  authenticate,
  requireRole(['Gestor']),
  validate(demandStatusSchema),
  demandController.updateStatus
);

// Created by AI.
// Updated by AI.
// The owner (Cidadao) or a Gestor may delete — the ownership check itself
// lives in demandService.deleteDemand, since it needs the demand's row.
router.delete('/:id', authenticate, demandController.delete);

export default router;
