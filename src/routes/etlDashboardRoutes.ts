import { Router } from 'express';
import { etlDashboardController } from '../controllers/etlDashboardController';

const router = Router();

// Created by AI.
router.get('/population', etlDashboardController.listPopulation);

export default router;
