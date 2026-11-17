import type { NextFunction, Request, Response } from 'express';
import { validate } from '../middlewares/validate';
import { AppError } from '../middlewares/errorMiddleware';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateMeSchema,
} from './authSchemas';
import { DEMAND_DESCRIPTION_MAX, demandSchema, demandStatusSchema } from './demandSchemas';

// Created by AI.
// Payloads iguais aos enviados por mobile/src/services/auth-service.ts e
// demand-service.ts.
const appRegister = {
  nome: 'Maria da Silva',
  email: 'maria@example.com',
  senha: 'Senha@1234',
  dataNascimento: '1990-05-20',
  cpf: '12345678901',
  rua: 'Rua da Aurora',
  numero: '100',
  bairro: 'Boa Vista',
  cidade: 'Recife',
  estado: 'PE',
  cep: '50050-000',
  complemento: 'Apto 1',
  privacyPolicyVersion: '2026-01',
};

// Created by AI.
const appDemand = {
  title: 'Buraco na via',
  description: 'Buraco grande perto da esquina.',
  category_id: 1,
  cep: '50050-000',
  rua: 'Rua da Aurora',
  numero: null,
  bairro: 'Boa Vista',
  cidade: 'Recife',
  estado: 'PE',
  complemento: null,
  latitude: -8.05,
  longitude: -34.88,
};

// Created by AI.
function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

// Created by AI.
describe('schemas de validação (RNF-SEC-13)', () => {
  it('aceitam os payloads que o app envia hoje', () => {
    expect(registerSchema.safeParse(appRegister).success).toBe(true);
    expect(
      loginSchema.safeParse({ email: 'a@b.co', senha: 'x', deviceId: 'abc', deviceName: 'iPhone' }).success
    ).toBe(true);
    expect(refreshTokenSchema.safeParse({ refreshToken: 'rt' }).success).toBe(true);
    expect(refreshTokenSchema.safeParse({ refreshToken: null }).success).toBe(true);
    expect(
      updateMeSchema.safeParse({ nome: 'Maria', email: 'a@b.co', rua: null, numero: null, cep: null }).success
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        senhaAtual: 'a', novaSenha: 'b', confirmarNovaSenha: 'b', mfaToken: 't',
      }).success
    ).toBe(true);
    expect(demandSchema.safeParse(appDemand).success).toBe(true);
    expect(demandStatusSchema.safeParse({ status_id: 'Em_Andamento' }).success).toBe(true);
  });

  it('deixam campos ausentes ou vazios para o controller (mensagens atuais)', () => {
    expect(registerSchema.safeParse({}).success).toBe(true);
    expect(loginSchema.safeParse({ email: '', senha: '' }).success).toBe(true);
    expect(demandSchema.safeParse({ title: '', category_id: '' }).success).toBe(true);
    expect(demandSchema.safeParse({ category_id: 0 }).success).toBe(true);
    expect(demandStatusSchema.safeParse({}).success).toBe(true);
  });

  it('aceitam números onde o controller já converte com String()', () => {
    expect(registerSchema.safeParse({ ...appRegister, numero: 100, cpf: 12345678901 }).success).toBe(true);
    expect(demandSchema.safeParse({ ...appDemand, category_id: '3', latitude: '-8.05' }).success).toBe(true);
  });

  it('rejeitam texto maior que a coluna do banco', () => {
    expect(firstMessage(demandSchema.safeParse({ ...appDemand, title: 'x'.repeat(101) }))).toBe(
      'title deve ser texto com até 100 caracteres.'
    );
    expect(firstMessage(registerSchema.safeParse({ ...appRegister, estado: 'PER' }))).toBe(
      'estado deve ser texto com até 2 caracteres.'
    );
    expect(
      demandSchema.safeParse({ ...appDemand, description: 'x'.repeat(DEMAND_DESCRIPTION_MAX + 1) }).success
    ).toBe(false);
  });

  it('rejeitam tipos errados', () => {
    expect(firstMessage(loginSchema.safeParse({ email: { $ne: '' }, senha: 'x' }))).toBe(
      'email e senha devem ser texto.'
    );
    expect(firstMessage(demandSchema.safeParse({ ...appDemand, category_id: 'abc' }))).toBe(
      'category_id deve ser um número inteiro.'
    );
    expect(firstMessage(demandSchema.safeParse({ ...appDemand, latitude: true }))).toBe(
      'Coordenadas inválidas. Use a localização obtida pelo CEP ou pelo GPS.'
    );
    expect(firstMessage(refreshTokenSchema.safeParse({ refreshToken: 123 }))).toBe(
      'Refresh token obrigatório.'
    );
    expect(firstMessage(demandStatusSchema.safeParse({ status_id: ['Aberto'] }))).toBe('Status inválido.');
  });
});

// Created by AI.
describe('middleware validate', () => {
  function run(body: unknown) {
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    validate(demandStatusSchema)({ body } as Request, {} as Response, next);
    return next.mock.calls[0]?.[0];
  }

  it('segue para o controller sem alterar o corpo quando é válido', () => {
    const body = { status_id: 'Aberto', extra: 1 };
    expect(run(body)).toBeUndefined();
    expect(body).toEqual({ status_id: 'Aberto', extra: 1 });
  });

  it('responde 400 com a mensagem do primeiro problema', () => {
    const error = run({ status_id: { x: 1 } });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 400, message: 'Status inválido.' });
  });

  it('deixa corpo em array seguir para o controller (resposta atual)', () => {
    expect(run([1, 2])).toBeUndefined();
  });

  it('trata corpo ausente como objeto vazio', () => {
    expect(run(undefined)).toBeUndefined();
  });
});
