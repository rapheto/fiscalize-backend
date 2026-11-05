import { rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import {
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_DEMAND_MAX,
  RATE_LIMIT_GENERAL_MAX,
  RATE_LIMIT_OTP_MAX,
  RATE_LIMIT_REDIS_REQUIRED,
  RATE_LIMIT_WINDOW_MS,
} from '../config/env';
import { getRedisClient } from '../config/redis';

// Created by AI.
function redisCommand(
  command: string,
  ...args: string[]
): Promise<RedisReply> {
  const client = getRedisClient();
  if (!client) {
    throw new Error('Redis is required for rate limiting but is unavailable');
  }
  return client.call(command, ...args) as Promise<RedisReply>;
}

// Created by AI.
// Updated by AI.
function storeForRateLimit(name: string): Options['store'] | undefined {
  const client = getRedisClient();
  if (client) {
    return new RedisStore({
      prefix: `fiscalize:rate-limit:${name}:`,
      sendCommand: redisCommand,
    });
  }
  if (RATE_LIMIT_REDIS_REQUIRED) {
    throw new Error(
      'RATE_LIMIT_REDIS_REQUIRED is enabled but REDIS_URL is not configured'
    );
  }
  return undefined;
}

// Created by AI.
function createLimiter(max: number, name: string) {
  const store = storeForRateLimit(name);
  const options = {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: name,
    message: {
      error: 'Too many requests',
      message: 'Limite de requisições excedido. Tente novamente mais tarde.',
    },
    passOnStoreError: false,
    ...(store ? { store } : {}),
  } satisfies Partial<Options>;
  return rateLimit(options);
}

// Created by AI.
export const generalRateLimiter = createLimiter(
  RATE_LIMIT_GENERAL_MAX,
  'general'
);

// Created by AI.
export const authenticationRateLimiter = createLimiter(
  RATE_LIMIT_AUTH_MAX,
  'authentication'
);

// Created by AI.
export const otpRateLimiter = createLimiter(RATE_LIMIT_OTP_MAX, 'otp');

// Created by AI.
export const demandCreationRateLimiter = createLimiter(
  RATE_LIMIT_DEMAND_MAX,
  'demand-creation'
);
