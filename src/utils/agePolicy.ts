import { AppError } from '../middlewares/errorMiddleware';

// Created by AI.
export function assertAdultBirthDate(value: unknown, now = new Date()): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'Data de nascimento inválida. Use o formato AAAA-MM-DD.');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    throw new AppError(400, 'Data de nascimento inválida.');
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (birthDate > today) {
    throw new AppError(400, 'A data de nascimento não pode estar no futuro.');
  }

  let age = today.getUTCFullYear() - year;
  const hasHadBirthday =
    today.getUTCMonth() > month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() >= day);
  if (!hasHadBirthday) age -= 1;

  if (age < 18) {
    throw new AppError(400, 'O cadastro é permitido somente para pessoas com 18 anos ou mais.');
  }

  return birthDate;
}
