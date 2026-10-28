import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProduction = NODE_ENV === 'production';

// Updated by AI.
export const JWT_SECRET = requireEnv('JWT_SECRET');
// Updated by AI.
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '30m';
// Created by AI.
export const REFRESH_TOKEN_EXPIRATION_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRATION_DAYS || 30
);
// Created by AI.
export const OTP_EMAIL_FROM = process.env.OTP_EMAIL_FROM || 'no-reply@fiscalize.local';
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const OTP_EXPIRATION_MINUTES = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const MFA_VERIFICATION_EXPIRATION_MINUTES = 10;

export const PORT = Number(process.env.PORT) || 3000;

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && fromEnv.length === 0) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGINS');
  }

  return fromEnv;
}
