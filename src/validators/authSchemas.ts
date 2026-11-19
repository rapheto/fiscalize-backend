import { z } from 'zod';
import { stringOnly, text } from './fields';

// Created by AI.
// Schemas das rotas de autenticação usadas pelo app (RNF-SEC-13).
// Limites = tamanho das colunas em prisma/schema.prisma (usuario, cidadao,
// usuario_dispositivo). Campos não listados passam sem alteração.

// Created by AI.
// Campos de endereço do cadastro e do perfil do cidadão (tabela cidadao).
const citizenAddress = {
  rua: text('rua', 150),
  numero: text('numero', 20),
  bairro: text('bairro', 100),
  cidade: text('cidade', 100),
  estado: text('estado', 2),
  cep: text('cep', 9),
  complemento: text('complemento', 150),
};

// Created by AI.
// POST /auth/register
export const registerSchema = z.looseObject({
  nome: text('nome', 150),
  email: text('email', 100),
  senha: stringOnly('Senha deve ser texto.'),
  cpf: text('cpf', 30),
  dataNascimento: text('dataNascimento', 30),
  ...citizenAddress,
});

// Created by AI.
// POST /auth/login. Sem limite de tamanho em email e senha, para não mudar a
// resposta de login de nenhuma conta existente.
export const loginSchema = z.looseObject({
  email: stringOnly('email e senha devem ser texto.'),
  senha: stringOnly('email e senha devem ser texto.'),
  deviceName: text('deviceName', 120),
});

// Created by AI.
// POST /auth/refresh e POST /auth/logout
export const refreshTokenSchema = z.looseObject({
  refreshToken: stringOnly('Refresh token obrigatório.'),
});

// Created by AI.
// PUT /auth/me
export const updateMeSchema = z.looseObject({
  nome: text('nome', 150),
  email: text('email', 100),
  ...citizenAddress,
});

// Created by AI.
// PATCH /auth/me/password
export const changePasswordSchema = z.looseObject({
  senhaAtual: stringOnly('Informe a senha atual, a nova senha e a confirmação.'),
  novaSenha: stringOnly('Informe a senha atual, a nova senha e a confirmação.'),
  confirmarNovaSenha: stringOnly('Informe a senha atual, a nova senha e a confirmação.'),
});
