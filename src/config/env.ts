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
export const GMAIL_USER = process.env.GMAIL_USER;
// Created by AI.
export const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
// Created by AI.
// Updated by AI.
export const OTP_EMAIL_FROM =
  process.env.OTP_EMAIL_FROM || GMAIL_USER || 'no-reply@fiscalize.local';

// Created by AI.
// Updated by AI.
export function assertEmailTransportConfigured(): void {
  if (isProduction && (!GMAIL_USER || !GMAIL_APP_PASSWORD)) {
    throw new Error(
      'Missing email credentials: set GMAIL_USER and GMAIL_APP_PASSWORD so MFA codes can be delivered.'
    );
  }
  if (isProduction && /@[^@]*\.local$/i.test(OTP_EMAIL_FROM)) {
    throw new Error(
      `OTP_EMAIL_FROM="${OTP_EMAIL_FROM}" is not a deliverable sender. Set a verified sender or domain.`
    );
  }
}

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
