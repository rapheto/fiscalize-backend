import { expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authService } from '../services/authService';
import { authenticate } from './authMiddleware';

// Created by AI.
jest.mock('../services/authService', () => ({
  authService: {
    getUserById: jest.fn(),
    isTokenBlocked: jest.fn(),
  },
}));

// Created by AI.
jest.mock('../config/env', () => ({ JWT_SECRET: 'auth-middleware-test-secret' }));

// Created by AI.
it('forwards database failures instead of returning an unauthorized response', async () => {
  const databaseError = new Error('Database unavailable');
  jest.mocked(authService.isTokenBlocked).mockReturnValue(false);
  jest.mocked(authService.getUserById).mockRejectedValue(databaseError);

  const token = jwt.sign(
    { id: 'user-id', email: 'user@example.test', perfil: 'Cidadao' },
    'auth-middleware-test-secret'
  );
  const req = {
    cookies: {},
    headers: { authorization: `Bearer ${token}` },
  } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  await authenticate(req, res, next);

  expect(res.status).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith(databaseError);
});
