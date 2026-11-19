import { NextFunction, Request, Response } from 'express';

import { AppError } from '../middlewares/errorMiddleware';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  getNotificationPreference,
  listNotificationsForUser,
  markNotificationRead,
  registerPushToken,
  sendTestPushNotification,
  updateNotificationPreference,
} from '../services/notificationService';

// Updated by AI.
export const notificationController = {
  // Created by AI.
  async getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const enabled = await getNotificationPreference(req.user!.id);
      res.status(200).json({ enabled });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new AppError(400, 'Corpo da requisição inválido.');
      }

      const { enabled } = body as Record<string, unknown>;
      if (typeof enabled !== 'boolean') {
        throw new AppError(400, 'enabled deve ser um valor booleano.');
      }

      const updated = await updateNotificationPreference(req.user!.id, enabled);
      res.status(200).json({ enabled: updated });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async testPush(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new AppError(400, 'Corpo da requisição inválido.');
      }

      const { deviceId, type } = body as Record<string, unknown>;
      if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        throw new AppError(400, 'deviceId é obrigatório.');
      }
      if (type !== 'demand_created' && type !== 'status_updated') {
        throw new AppError(400, 'Tipo de notificação de teste inválido.');
      }

      const result = await sendTestPushNotification(req.user!.id, deviceId, type);
      if (result !== 'sent') {
        const statusCode = result === 'notifications_disabled' || result === 'device_not_registered'
          ? 409
          : 502;
        const messages = {
          notifications_disabled: 'Ative as notificações para executar os testes.',
          device_not_registered: 'Este aparelho ainda não está registrado para receber notificações.',
          push_not_configured: 'O envio de push não está configurado no servidor.',
          delivery_failed: 'Não foi possível entregar a notificação de teste.',
        };
        throw new AppError(statusCode, messages[result]);
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },

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
