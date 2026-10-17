import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../middlewares/errorMiddleware';
import { prisma } from '../config/prisma';
import { JWT_SECRET, JWT_EXPIRATION } from '../config/env';
import { assertPasswordPolicy } from '../utils/passwordPolicy';

// Blocklist em memória (em produção: Redis)
const tokenBlocklist = new Set<string>();
// Created by AI.
// Updated by AI.
const BCRYPT_COST = 10;
// Created by AI.
// Updated by AI.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
// Created by AI.
// Updated by AI.
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export const authService = {
  // Created by AI.
  // Updated by AI.
  async register(nome: string, email: string, senha: string) {
    assertPasswordPolicy(senha);

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new AppError(409, 'E-mail já cadastrado.');
    }

    const hashedPassword = await bcrypt.hash(senha, BCRYPT_COST);

    const usuario = await prisma.$transaction(async (tx: any) => {
      const created = await tx.usuario.create({
        data: {
          nome,
          email,
          senha: hashedPassword,
          perfil: 'Cidadao',
          status: 'Ativo', // ✔ conforme schema.prisma
        },
      });

      await tx.cidadao.create({
        data: { id: created.id },
      });

      return created;
    });

    return usuario;
  },

  // Created by AI.
  // Updated by AI.
  async login(email: string, senha: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new AppError(401, 'Credenciais inválidas.');
    }

    const now = new Date();

    if (usuario.bloqueado_ate && usuario.bloqueado_ate > now) {
      throw new AppError(
        423,
        'Conta temporariamente bloqueada após tentativas de login sem sucesso. Tente novamente mais tarde.'
      );
    }

    // ✔ CORRETO conforme ENUM do schema.prisma
    if (usuario.status !== 'Ativo') {
      throw new AppError(
        403,
        'Usuário inativo. Contate o administrador.'
      );
    }

    const isValidPassword = await bcrypt.compare(
      senha,
      usuario.senha
    );

    if (!isValidPassword) {
      const previousFailedAttempts =
        usuario.bloqueado_ate && usuario.bloqueado_ate <= now
          ? 0
          : usuario.tentativas_login_falhas;
      const failedAttempts = previousFailedAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          tentativas_login_falhas: shouldLock ? MAX_FAILED_LOGIN_ATTEMPTS : failedAttempts,
          ...(usuario.bloqueado_ate &&
            usuario.bloqueado_ate <= now &&
            { bloqueado_ate: null }),
          ...(shouldLock && {
            bloqueado_ate: new Date(Date.now() + LOGIN_LOCK_DURATION_MS),
          }),
        },
      });

      if (shouldLock) {
        throw new AppError(
          423,
          'Conta temporariamente bloqueada após 5 tentativas de login sem sucesso. Tente novamente em 15 minutos.'
        );
      }

      throw new AppError(401, 'Credenciais inválidas.');
    }

    if (usuario.tentativas_login_falhas > 0 || usuario.bloqueado_ate) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          tentativas_login_falhas: 0,
          bloqueado_ate: null,
        },
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION } as SignOptions
    );

    return { usuario, token };
  },

  async getUserById(userId: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        criadoem: true,
      },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    return usuario;
  },

  async addTokenToBlocklist(token: string) {
    try {
      const decoded = jwt.decode(token) as any;

      if (decoded && decoded.exp) {
        const ttl =
          decoded.exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
          tokenBlocklist.add(token);

          setTimeout(() => {
            tokenBlocklist.delete(token);
          }, ttl * 1000);
        }
      }
    } catch (error) {
      console.error(
        'Erro ao adicionar token à blocklist:',
        error
      );
    }
  },

  isTokenBlocked(token: string): boolean {
    return tokenBlocklist.has(token);
  },
};