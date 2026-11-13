import { NextFunction, Request, Response } from 'express';

import { AppError } from '../middlewares/errorMiddleware';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  listNotificationsForUser,
  markNotificationRead,
  registerPushToken,
} from '../services/notificationService';

export const notificationController = {
  async registerDevicePushToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { deviceId, deviceName, pushToken } = req.body as Record<string, unknown>;

      if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        throw new AppError(400, 'deviceId é obrigatório.');
      }

      if (typeof pushToken !== 'string' || pushToken.trim().length === 0) {
        throw new AppError(400, 'pushToken é obrigatório.');
      }

      await registerPushToken(req.user!.id, deviceId, typeof deviceName === 'string' ? deviceName : null, pushToken);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await listNotificationsForUser(req.user!.id);
      res.status(200).json(notifications);
    } catch (error) {
      next(error);
    }
  },

  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (Array.isArray(id) || !id) {
        throw new AppError(400, 'ID da notificação inválido.');
      }

      await markNotificationRead(id, req.user!.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
