import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Resend } from 'resend';

import { AppError } from '../middlewares/errorMiddleware';
import { deliverEmailOtp, OTP_PURPOSE } from './otpService';

// Created by AI.
let mockResendApiKey: string | undefined = 're_test_key';
// Created by AI.
let mockIsProduction = false;
// Created by AI.
const mockSend = jest.fn();

// Created by AI.
jest.mock('../config/env', () => ({
  get RESEND_API_KEY() {
    return mockResendApiKey;
  },
  get isProduction() {
    return mockIsProduction;
  },
  OTP_EMAIL_FROM: 'onboarding@resend.dev',
  OTP_EXPIRATION_MINUTES: 5,
}));

// Created by AI.
jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

// Created by AI.
describe('deliverEmailOtp', () => {
  beforeEach(() => {
    mockResendApiKey = 're_test_key';
    mockIsProduction = false;
    mockSend.mockReset();
    jest.mocked(Resend).mockImplementation(
      () =>
        ({
          emails: {
            send: mockSend,
          },
        }) as unknown as Resend
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Created by AI.
  it('sends the OTP through Resend with the existing subject and text', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'email-id' },
      error: null,
      headers: null,
    });

    await deliverEmailOtp('cidadao@example.test', '123456', OTP_PURPOSE.LOGIN);

    expect(mockSend).toHaveBeenCalledWith(
      {
        from: 'onboarding@resend.dev',
        to: 'cidadao@example.test',
        subject: 'Código de acesso ao Fiscalize',
        text: 'Seu código Fiscalize é 123456. Ele expira em 5 minutos e só pode ser usado uma vez.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  // Created by AI.
  it('maps API errors to the existing 503 response', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSend.mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        statusCode: 422,
        message: 'Sensitive provider detail',
      },
      headers: null,
    });

    await expect(
      deliverEmailOtp('cidadao@example.test', '123456', OTP_PURPOSE.CRITICAL)
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      message: 'Não foi possível enviar o código temporário.',
    });

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'Sensitive provider detail'
    );
  });

  // Created by AI.
  it('maps SDK and network exceptions to the existing 503 response', async () => {
    mockSend.mockRejectedValue(new Error('Network failure'));

    await expect(
      deliverEmailOtp('cidadao@example.test', '123456', OTP_PURPOSE.LOGIN)
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      message: 'Não foi possível enviar o código temporário.',
    });
  });

  // Created by AI.
  it('times out a stalled Resend request and returns the existing 503 response', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSend.mockImplementation(
      (_payload: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              const abortError = new Error('Request aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            },
            { once: true }
          );
        })
    );

    const delivery = deliverEmailOtp(
      'cidadao@example.test',
      '123456',
      OTP_PURPOSE.LOGIN
    );
    const deliveryExpectation = expect(delivery).rejects.toMatchObject<AppError>({
      statusCode: 503,
      message: 'Não foi possível enviar o código temporário.',
    });
    await jest.advanceTimersByTimeAsync(10_000);
    await deliveryExpectation;
    jest.useRealTimers();
  });

  // Created by AI.
  it('does not expose or log OTP codes in production without configuration', async () => {
    mockResendApiKey = undefined;
    mockIsProduction = true;
    const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(
      deliverEmailOtp('cidadao@example.test', '123456', OTP_PURPOSE.LOGIN)
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      message: 'Serviço de entrega de código temporariamente indisponível.',
    });

    expect(consoleInfo).not.toHaveBeenCalled();
  });

  // Created by AI.
  it('logs OTP codes only outside production when configuration is absent', async () => {
    mockResendApiKey = undefined;
    mockIsProduction = false;
    const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await deliverEmailOtp('cidadao@example.test', '123456', OTP_PURPOSE.LOGIN);

    // Updated by AI.
    // RNF-SEC-16: o código aparece no log de desenvolvimento, mas o e-mail não.
    expect(consoleInfo).toHaveBeenCalledWith(`[MFA DEV] OTP (${OTP_PURPOSE.LOGIN}): 123456`);
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain('cidadao@example.test');
  });
});
