import { Router } from 'express';
import { etlDashboardController } from '../controllers/etlDashboardController';

const router = Router();

// Created by AI.
router.get('/population', etlDashboardController.listPopulation);

// Created by AI.
router.get('/climate', etlDashboardController.listClimate);

export default router;
