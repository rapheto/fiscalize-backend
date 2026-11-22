import { afterAll, describe, expect, it, jest } from '@jest/globals';

// Created by AI.
const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  OTP_EMAIL_FROM: process.env.OTP_EMAIL_FROM,
};

// Created by AI.
afterAll(() => {
  jest.resetModules();
  if (originalEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
  if (originalEnv.OTP_EMAIL_FROM === undefined) delete process.env.OTP_EMAIL_FROM;
  else process.env.OTP_EMAIL_FROM = originalEnv.OTP_EMAIL_FROM;
});

// Created by AI.
async function loadEnv() {
  jest.resetModules();
  process.env.JWT_SECRET = 'test-jwt-secret';
  return require('./env') as typeof import('./env');
}

// Created by AI.
describe('isValidOtpEmailFrom', () => {
  it('accepts the test, plain and friendly-name sender formats', async () => {
    const { isValidOtpEmailFrom } = await loadEnv();

    expect(isValidOtpEmailFrom('onboarding@resend.dev')).toBe(true);
    expect(isValidOtpEmailFrom('otp@dominio.com')).toBe(true);
    expect(isValidOtpEmailFrom('Fiscalize <otp@dominio.com>')).toBe(true);
  });

  it('rejects malformed sender values', async () => {
    const { isValidOtpEmailFrom } = await loadEnv();

    expect(isValidOtpEmailFrom('')).toBe(false);
    expect(isValidOtpEmailFrom('dominio.com')).toBe(false);
    expect(isValidOtpEmailFrom('usuario@')).toBe(false);
    expect(isValidOtpEmailFrom('Fiscalize <usuario@dominio>')).toBe(false);
    expect(isValidOtpEmailFrom('<usuario@dominio.com>')).toBe(false);
    expect(isValidOtpEmailFrom('Fiscalize usuario@dominio.com')).toBe(false);
  });
});

// Created by AI.
describe('assertEmailTransportConfigured', () => {
  it('throws in production when the Resend API key is absent', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    process.env.OTP_EMAIL_FROM = 'onboarding@resend.dev';

    const { assertEmailTransportConfigured } = require('./env') as typeof import('./env');
    expect(() => assertEmailTransportConfigured()).toThrow(
      'Missing email credentials'
    );
  });

  it('accepts the test sender and a friendly-name sender in production', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 're_test_key';

    process.env.OTP_EMAIL_FROM = 'onboarding@resend.dev';
    const testSenderEnv = require('./env') as typeof import('./env');
    expect(() => testSenderEnv.assertEmailTransportConfigured()).not.toThrow();

    jest.resetModules();
    process.env.OTP_EMAIL_FROM = 'Fiscalize <otp@dominio.com>';
    const friendlySenderEnv = require('./env') as typeof import('./env');
    expect(() => friendlySenderEnv.assertEmailTransportConfigured()).not.toThrow();
  });

  it('rejects an API key in production only when it has invalid basic format', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'invalid-key';
    process.env.OTP_EMAIL_FROM = 'onboarding@resend.dev';

    const { assertEmailTransportConfigured } = require('./env') as typeof import('./env');
    expect(() => assertEmailTransportConfigured()).toThrow(
      'Missing email credentials'
    );
  });

  it('rejects malformed senders in production', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.OTP_EMAIL_FROM = 'Fiscalize usuario@dominio.com';

    const { assertEmailTransportConfigured } = require('./env') as typeof import('./env');
    expect(() => assertEmailTransportConfigured()).toThrow(
      'is not a deliverable sender'
    );
  });
});
