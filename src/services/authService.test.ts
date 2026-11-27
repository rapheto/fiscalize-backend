import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../middlewares/errorMiddleware';

// Created by AI.
const mockUserFindUnique = jest.fn();
// Created by AI.
const mockOtpFindFirst = jest.fn();
// Created by AI.
const mockOtpCreate = jest.fn();
// Created by AI.
const mockOtpDelete = jest.fn();
// Created by AI.
const mockDeliverEmailOtp = jest.fn();

// Created by AI.
jest.mock('../config/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: mockUserFindUnique,
    },
    otp_challenge: {
      findFirst: mockOtpFindFirst,
      create: mockOtpCreate,
      delete: mockOtpDelete,
    },
  },
}));

// Created by AI.
jest.mock('../config/env', () => ({
  JWT_SECRET: 'test-jwt-secret',
  JWT_EXPIRATION: '30m',
  REFRESH_TOKEN_EXPIRATION_DAYS: 30,
  MFA_VERIFICATION_EXPIRATION_MINUTES: 10,
  OTP_EXPIRATION_MINUTES: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
}));

// Created by AI.
jest.mock('./otpService', () => ({
  OTP_PURPOSE: {
    LOGIN: 'LOGIN_NEW_DEVICE',
    CRITICAL: 'CRITICAL_ACTION',
  },
  createChallengeToken: jest.fn(() => 'challenge-token'),
  createOtpCode: jest.fn(() => '123456'),
  deliverEmailOtp: mockDeliverEmailOtp,
  hashValue: jest.fn((value: string) => `hash:${value}`),
  maskEmail: jest.fn((email: string) => `m***@${email.split('@')[1] ?? ''}`),
}));

// Created by AI.
import { authService } from './authService';

// Created by AI.
describe('authService.createOtpChallenge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Created by AI.
  it('removes the created challenge and preserves 503 when Resend delivery fails', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'cidadao@example.test',
    });
    mockOtpFindFirst.mockResolvedValue(null);
    mockOtpCreate.mockResolvedValue({
      id: 'challenge-row-id',
      destination: 'c***@example.test',
    });
    mockDeliverEmailOtp.mockRejectedValue(
      new AppError(503, 'Não foi possível enviar o código temporário.')
    );

    await expect(
      authService.createOtpChallenge(
        'user-id',
        'LOGIN_NEW_DEVICE'
      )
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      message: 'Não foi possível enviar o código temporário.',
    });

    expect(mockOtpCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuario_id: 'user-id',
          purpose: 'LOGIN_NEW_DEVICE',
        }),
      })
    );
    expect(mockOtpDelete).toHaveBeenCalledWith({
      where: { id: 'challenge-row-id' },
    });
  });
});
