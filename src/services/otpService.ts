import { createHash, randomBytes, randomInt } from 'crypto';
import { Resend } from 'resend';
import {
  RESEND_API_KEY,
  isProduction,
  OTP_EMAIL_FROM,
  OTP_EXPIRATION_MINUTES,
} from '../config/env';
import { AppError } from '../middlewares/errorMiddleware';

// Created by AI.
const EMAIL_TIMEOUT_MS = 10_000;

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
// Created by AI.
// Updated by AI.
let resendClient: Resend | null = null;

// Created by AI.
// Updated by AI.
function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new AppError(503, 'Serviço de entrega de código temporariamente indisponível.');
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

// Created by AI.
// Updated by AI.
async function sendViaResend(destination: string, subject: string, text: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const { error } = await getResendClient().emails.send(
      {
        from: OTP_EMAIL_FROM,
        to: destination,
        subject,
        text,
      },
      { signal: controller.signal }
    );

    if (error) {
      console.error('[OTP] Resend API rejected the message', {
        name: error.name,
        statusCode: error.statusCode,
      });
      throw new AppError(503, 'Não foi possível enviar o código temporário.');
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const failure = error as { name?: string; code?: string };
    console.error('[OTP] Resend request failed', {
      name: failure.name,
      code: failure.code,
    });
    throw new AppError(503, 'Não foi possível enviar o código temporário.');
  } finally {
    clearTimeout(timeout);
  }
}

// Created by AI.
// Updated by AI.
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
    if (isProduction) {
      throw new AppError(503, 'Serviço de entrega de código temporariamente indisponível.');
    }
    console.info(`[MFA DEV] OTP para ${destination}: ${code}`);
    return;
  }

  await sendViaResend(destination, subject, text);
}
