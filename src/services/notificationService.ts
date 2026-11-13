import { createHash } from 'crypto';
import { tipo_notificacao } from '@prisma/client';

import { EXPO_ACCESS_TOKEN } from '../config/env';
import { prisma } from '../config/prisma';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const NOTIFICATION_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function hashDeviceId(deviceId: string): string {
  return createHash('sha256').update(deviceId.trim()).digest('hex');
}

export async function registerPushToken(
  userId: string,
  deviceId: string,
  deviceName: string | null,
  pushToken: string
) {
  const deviceHash = hashDeviceId(deviceId);
  const trimmedPushToken = pushToken.trim();

  const existing = await prisma.usuario_dispositivo.findUnique({
    where: {
      usuario_id_device_hash: { usuario_id: userId, device_hash: deviceHash },
    },
  });

  if (existing) {
    return prisma.usuario_dispositivo.update({
      where: { id: existing.id },
      data: {
        push_token: trimmedPushToken,
        push_token_updated_at: new Date(),
        device_name: deviceName ?? existing.device_name,
        last_used_at: new Date(),
      },
    });
  }

  return prisma.usuario_dispositivo.create({
    data: {
      usuario_id: userId,
      device_hash: deviceHash,
      device_name: deviceName,
      push_token: trimmedPushToken,
      push_token_updated_at: new Date(),
      trusted: true,
      last_used_at: new Date(),
    },
  });
}

export async function listNotificationsForUser(userId: string) {
  return prisma.notificacao.findMany({
    where: { usuarioid: userId },
    orderBy: { criadoem: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notificacao.updateMany({
    where: { id, usuarioid: userId, lida: false },
    data: { lida: true, lida_em: new Date() },
  });
}

export async function notifyDemandCreated(userId: string, chamadoId: string, protocolo: string) {
  const existing = await prisma.notificacao.findFirst({
    where: {
      usuarioid: userId,
      chamadoid: chamadoId,
      tipo: 'chamado_registrado',
      criadoem: {
        gt: new Date(Date.now() - NOTIFICATION_DUPLICATE_WINDOW_MS),
      },
    },
  });

  if (existing) {
    return existing;
  }

  const notification = await prisma.notificacao.create({
    data: {
      usuarioid: userId,
      titulo: 'Ocorrência registrada',
      mensagem: `Sua ocorrência ${protocolo} foi recebida com sucesso!`,
      tipo: 'chamado_registrado',
      chamadoid: chamadoId,
    },
  });

  await sendPushNotification(userId, {
    title: 'Ocorrência registrada',
    body: `Sua ocorrência ${protocolo} foi recebida com sucesso!`,
    data: { type: 'chamado_registrado', chamadoId },
  });

  return notification;
}

export async function notifyDemandStatusChange({
  userId,
  chamadoId,
  protocolo,
  fromStatus,
  toStatus,
}: {
  userId: string;
  chamadoId: string;
  protocolo: string;
  fromStatus: string;
  toStatus: string;
}) {
  if (fromStatus === toStatus) {
    return null;
  }

  const existing = await prisma.notificacao.findFirst({
    where: {
      usuarioid: userId,
      chamadoid: chamadoId,
      tipo: 'status_atualizado',
      criadoem: {
        gt: new Date(Date.now() - NOTIFICATION_DUPLICATE_WINDOW_MS),
      },
    },
  });

  if (existing) {
    return existing;
  }

  const displayStatus = toStatus.replace('Em_An_lise', 'Em Análise').replace('Em_Andamento', 'Em Andamento');

  const notification = await prisma.notificacao.create({
    data: {
      usuarioid: userId,
      titulo: 'Status da ocorrência atualizado',
      mensagem: `Sua ocorrência ${protocolo} está ${displayStatus}.`,
      tipo: 'status_atualizado',
      chamadoid: chamadoId,
    },
  });

  await sendPushNotification(userId, {
    title: 'Status da ocorrência atualizado',
    body: `Sua ocorrência ${protocolo} está ${displayStatus}.`,
    data: { type: 'status_atualizado', chamadoId },
  });

  return notification;
}

async function sendPushNotification(
  userId: string,
  payload: {
    title: string;
    body: string;
    data: Record<string, string>;
  }
) {
  if (!EXPO_ACCESS_TOKEN) {
    return;
  }

  const devices = await prisma.usuario_dispositivo.findMany({
    where: {
      usuario_id: userId,
      push_token: { not: null },
    },
    select: {
      id: true,
      push_token: true,
    },
  });

  for (const device of devices) {
    if (!device.push_token) continue;

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: device.push_token,
          title: payload.title,
          body: payload.body,
          sound: 'default',
          priority: 'high',
          data: payload.data,
        }),
      });

      const body = await response.text();
      if (!response.ok) {
        const json = safeJson(body) as { errors?: Array<{ message?: string }> } | null;
        const invalidToken = json?.errors?.some((error) => /invalid/i.test(error.message ?? ''));
        if (invalidToken) {
          await prisma.usuario_dispositivo.update({
            where: { id: device.id },
            data: { push_token: null, push_token_updated_at: new Date() },
          });
        }
      }
    } catch {
      // The notification remains stored in the database and the client can fetch it in-app.
    }
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
