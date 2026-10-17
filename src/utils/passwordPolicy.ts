import { AppError } from '../middlewares/errorMiddleware';

// Created by AI.
export const PASSWORD_MIN_LENGTH = 8;

// Created by AI.
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

// Created by AI.
export function isPasswordPolicyValid(password: string): boolean {
  return passwordPolicy.test(password);
}

// Created by AI.
export function assertPasswordPolicy(password: string): void {
  if (!isPasswordPolicyValid(password)) {
    throw new AppError(
      400,
      'Senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas e minúsculas, número e caractere especial.'
    );
  }
}
