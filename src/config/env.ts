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
// Created by AI.
export const ETL_DATABASE_URL = process.env.ETL_DATABASE_URL;
// Created by AI.
// Updated by AI.
export const TRUST_PROXY =
  process.env.TRUST_PROXY || (NODE_ENV === 'test' || isProduction ? '1' : '0');

// Created by AI.
function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

// Created by AI.
export const RATE_LIMIT_GENERAL_MAX = positiveIntegerEnv(
  'RATE_LIMIT_GENERAL_MAX',
  100
);
// Created by AI.
export const RATE_LIMIT_AUTH_MAX = positiveIntegerEnv('RATE_LIMIT_AUTH_MAX', 10);
// Created by AI.
export const RATE_LIMIT_OTP_MAX = positiveIntegerEnv('RATE_LIMIT_OTP_MAX', 5);
// Created by AI.
export const RATE_LIMIT_DEMAND_MAX = positiveIntegerEnv(
  'RATE_LIMIT_DEMAND_MAX',
  10
);
// Created by AI.
export const RATE_LIMIT_WINDOW_MS = positiveIntegerEnv(
  'RATE_LIMIT_WINDOW_MS',
  60_000
);
// Created by AI.
export const RATE_LIMIT_REDIS_REQUIRED =
  process.env.RATE_LIMIT_REDIS_REQUIRED === 'true' || isProduction;

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
