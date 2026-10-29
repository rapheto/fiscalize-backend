import { createHash, randomBytes, randomInt } from 'crypto';
import { promises as dnsPromises } from 'dns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  GMAIL_APP_PASSWORD,
  GMAIL_USER,
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
type SenderIdentity = { email: string; name?: string };

// Created by AI.
function parseSender(raw: string): SenderIdentity {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (!match) return { email: raw.trim() };
  const name = match[1]?.trim();
  const email = match[2]?.trim();
  return name && email ? { email, name } : { email: raw.trim() };
}

// Created by AI.
function formatSender(sender: SenderIdentity): string {
  return sender.name ? `${sender.name} <${sender.email}>` : sender.email;
}

// Created by AI.
const GMAIL_HOST = 'smtp.gmail.com';
// Created by AI.
const GMAIL_PORT = 587;
// Created by AI.
const GMAIL_ADDRESS_TTL_MS = 10 * 60 * 1000;
// Created by AI.
const RETRYABLE_SMTP_CODES = new Set(['EDNS', 'ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED']);

// Created by AI.
let gmailTransport: Transporter | null = null;
// Created by AI.
let gmailAddress: { ip: string; expiresAt: number } | null = null;

// Created by AI.
async function resolveGmailAddress(): Promise<string> {
  if (gmailAddress && gmailAddress.expiresAt > Date.now()) {
    return gmailAddress.ip;
  }
  const { address } = await dnsPromises.lookup(GMAIL_HOST, { family: 4 });
  gmailAddress = { ip: address, expiresAt: Date.now() + GMAIL_ADDRESS_TTL_MS };
  return address;
}

// Created by AI.
async function getGmailTransport(): Promise<Transporter> {
  if (gmailTransport) return gmailTransport;
  const address = await resolveGmailAddress();
  gmailTransport = nodemailer.createTransport({
    host: address,
    port: GMAIL_PORT,
    secure: false,
    servername: GMAIL_HOST,
    auth: {
      user: GMAIL_USER as string,
      pass: GMAIL_APP_PASSWORD as string,
    },
    pool: true,
    maxConnections: 1,
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
  });
  return gmailTransport;
}

// Created by AI.
function resetGmailTransport(): void {
  if (gmailTransport) {
    try {
      gmailTransport.close();
    } catch {
      // ignore: the transport is discarded anyway
    }
  }
  gmailTransport = null;
  gmailAddress = null;
}

// Created by AI.
async function sendViaGmail(destination: string, subject: string, text: string): Promise<void> {
  const message = {
    from: formatSender(parseSender(OTP_EMAIL_FROM)),
    to: destination,
    subject,
    text,
  };

  try {
    await (await getGmailTransport()).sendMail(message);
  } catch (error) {
    const failure = error as { code?: string; responseCode?: number; message?: string };
    // A stale pooled connection or a rotated Gmail IP is recoverable: drop the
    // cached address and try once more before giving up.
    if (failure.code && RETRYABLE_SMTP_CODES.has(failure.code)) {
      resetGmailTransport();
      try {
        await (await getGmailTransport()).sendMail(message);
        return;
      } catch (retryError) {
        const retryFailure = retryError as { code?: string; responseCode?: number; message?: string };
        console.error('[OTP] Gmail SMTP rejected the message', {
          code: retryFailure.code,
          responseCode: retryFailure.responseCode,
          message: retryFailure.message,
        });
        throw new AppError(503, 'Não foi possível enviar o código temporário.');
      }
    }
    console.error('[OTP] Gmail SMTP rejected the message', {
      code: failure.code,
      responseCode: failure.responseCode,
      message: failure.message,
    });
    throw new AppError(503, 'Não foi possível enviar o código temporário.');
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

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    if (isProduction) {
      throw new AppError(503, 'Serviço de entrega de código temporariamente indisponível.');
    }
    console.info(`[MFA DEV] OTP para ${destination}: ${code}`);
    return;
  }

  await sendViaGmail(destination, subject, text);
}
