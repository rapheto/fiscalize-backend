import { Request, Response, NextFunction } from 'express';
import { etlDashboardService } from '../services/etlDashboardService';

// Created by AI.
export const etlDashboardController = {
  async listPopulation(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await etlDashboardService.listPopulation();
      res.status(200).json({ data, updatedAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  },
};
