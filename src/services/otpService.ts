import { createHash, randomBytes, randomInt } from 'crypto';
import {
  OTP_EMAIL_FROM,
  OTP_EXPIRATION_MINUTES,
  RESEND_API_KEY,
} from '../config/env';
import { AppError } from '../middlewares/errorMiddleware';

// Created by AI.
export const OTP_PURPOSE = {
  LOGIN: 'LOGIN_NEW_DEVICE',
  CRITICAL: 'CRITICAL_ACTION',
} as const;

// Created by AI.
export type CriticalAction = 'password' | 'export' | 'delete' | 'anonymization';

// Created by AI.
export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Created by AI.
export function createChallengeToken(): string {
  return randomBytes(32).toString('base64url');
}

// Created by AI.
export function createOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

// Created by AI.
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${(local ?? '').slice(0, 1)}***@${domain ?? ''}`;
}

// Created by AI.
export async function deliverEmailOtp(
  destination: string,
  code: string,
  purpose: (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE]
): Promise<void> {
  const subject = purpose === OTP_PURPOSE.LOGIN
    ? 'Código de acesso ao Fiscalize'
    : 'Código de confirmação de ação crítica';
  const text = `Seu código Fiscalize é ${code}. Ele expira em ${OTP_EXPIRATION_MINUTES} minutos e só pode ser usado uma vez.`;

  if (!RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(503, 'Serviço de entrega de código temporariamente indisponível.');
    }
    console.info(`[MFA DEV] OTP para ${destination}: ${code}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: OTP_EMAIL_FROM,
      to: [destination],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    console.error('Falha ao enviar OTP por e-mail', { status: response.status });
    throw new AppError(503, 'Não foi possível enviar o código temporário.');
  }
}
