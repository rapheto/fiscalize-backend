import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../middlewares/errorMiddleware';
import { prisma } from '../config/prisma';
import {
  JWT_SECRET,
  JWT_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION_DAYS,
} from '../config/env';
import { assertPasswordPolicy } from '../utils/passwordPolicy';
import {
  createChallengeToken,
  createOtpCode,
  deliverEmailOtp,
  hashValue,
  maskEmail,
  OTP_PURPOSE,
  type CriticalAction,
} from './otpService';
import {
  MFA_VERIFICATION_EXPIRATION_MINUTES,
  OTP_EXPIRATION_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '../config/env';

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
// Created by AI.
const REFRESH_TOKEN_BYTES = 32;

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Created by AI.
function hashDeviceId(deviceId: string): string {
  return hashValue(deviceId.trim());
}

// Created by AI.
async function issueSession(usuario: {
  id: string;
  email: string;
  nome: string;
  perfil: any;
}) {
  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION } as SignOptions
  );
  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  await prisma.refresh_token.create({
    data: {
      token_hash: hashRefreshToken(refreshToken),
      usuario_id: usuario.id,
      expires_at: createRefreshTokenExpiry(),
    },
  });
  return { usuario, token, refreshToken };
}

function createRefreshTokenExpiry(): Date {
  return new Date(
    Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );
}

export const authService = {
  // Created by AI.
  // Updated by AI.
  // Updated by AI.
  async register(
    nome: string,
    email: string,
    senha: string,
    profile: {
      cpf: string;
      rua: string;
      numero: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
      complemento?: string;
    }
  ) {
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
        data: {
          id: created.id,
          cpf: profile.cpf,
          rua: profile.rua,
          numero: profile.numero,
          bairro: profile.bairro,
          cidade: profile.cidade,
          estado: profile.estado,
          cep: profile.cep,
          complemento: profile.complemento ?? null,
          endereco: `${profile.rua}, ${profile.numero}, ${profile.bairro}, ${profile.cidade} - ${profile.estado}, CEP ${profile.cep}${profile.complemento ? `, ${profile.complemento}` : ''}`,
        },
      });

      return created;
    });

    return usuario;
  },

  // Created by AI.
  // Updated by AI.
  async login(email: string, senha: string, deviceId: string, deviceName?: string) {
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

    const deviceHash = hashDeviceId(deviceId);
    const device = await prisma.usuario_dispositivo.findUnique({
      where: { usuario_id_device_hash: { usuario_id: usuario.id, device_hash: deviceHash } },
    });

    if (!device || !device.trusted) {
      const challenge = await this.createOtpChallenge(
        usuario.id,
        OTP_PURPOSE.LOGIN,
        undefined,
        deviceHash,
        deviceName
      );
      return {
        mfaRequired: true as const,
        challengeToken: challenge.challengeToken,
        destination: challenge.destination,
        usuario,
      };
    }

    await prisma.usuario_dispositivo.update({
      where: { id: device.id },
      data: { last_used_at: new Date(), device_name: deviceName ?? device.device_name },
    });
    return { mfaRequired: false as const, ...(await issueSession(usuario)) };
  },

  // Created by AI.
  async createOtpChallenge(
    userId: string,
    purpose: (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE],
    action?: CriticalAction,
    deviceHash?: string,
    deviceName?: string
  ) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!usuario) throw new AppError(404, 'Usuário não encontrado.');

    const recent = await prisma.otp_challenge.findFirst({
      where: {
        usuario_id: userId,
        purpose,
        created_at: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000) },
        consumed_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    if (recent) throw new AppError(429, 'Aguarde antes de solicitar um novo código.');

    const code = createOtpCode();
    const challengeToken = createChallengeToken();
    const challenge = await prisma.otp_challenge.create({
      data: {
        usuario_id: userId,
        challenge_hash: hashValue(challengeToken),
        code_hash: hashValue(code),
        purpose,
        ...(action !== undefined && { action }),
        ...(deviceHash !== undefined && { device_hash: deviceHash }),
        ...(deviceName !== undefined && { device_name: deviceName }),
        destination: maskEmail(usuario.email),
        expires_at: new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000),
      },
    });

    try {
      await deliverEmailOtp(usuario.email, code, purpose);
    } catch (error) {
      await prisma.otp_challenge.delete({ where: { id: challenge.id } });
      throw error;
    }
    return { challengeToken, destination: challenge.destination };
  },

  // Created by AI.
  async verifyOtp(
    challengeToken: string,
    code: string,
    deviceId?: string
  ) {
    const challenge = await prisma.otp_challenge.findUnique({
      where: { challenge_hash: hashValue(challengeToken) },
      include: { usuario: true },
    });
    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.expires_at <= new Date() ||
      challenge.attempts >= 5
    ) {
      throw new AppError(401, 'Código temporário inválido ou expirado.');
    }

    if (hashValue(code) !== challenge.code_hash) {
      const attempts = challenge.attempts + 1;
      await prisma.otp_challenge.update({
        where: { id: challenge.id },
        data: { attempts, ...(attempts >= 5 ? { consumed_at: new Date() } : {}) },
      });
      throw new AppError(401, 'Código temporário inválido.');
    }

    await prisma.otp_challenge.update({
      where: { id: challenge.id },
      data: { verified_at: new Date(), consumed_at: challenge.purpose === OTP_PURPOSE.LOGIN ? new Date() : null },
    });

    if (challenge.purpose === OTP_PURPOSE.CRITICAL) {
      return {
        purpose: challenge.purpose,
        verificationToken: challengeToken,
        usuario: challenge.usuario,
      };
    }

    if (!challenge.device_hash || !deviceId || hashDeviceId(deviceId) !== challenge.device_hash) {
      throw new AppError(400, 'Dispositivo inválido para esta solicitação.');
    }
    await prisma.usuario_dispositivo.upsert({
      where: {
        usuario_id_device_hash: {
          usuario_id: challenge.usuario_id,
          device_hash: challenge.device_hash,
        },
      },
      create: {
        usuario_id: challenge.usuario_id,
        device_hash: challenge.device_hash,
        device_name: challenge.device_name,
      },
      update: {
        trusted: true,
        last_used_at: new Date(),
        device_name: challenge.device_name,
      },
    });
    return { purpose: challenge.purpose, ...(await issueSession(challenge.usuario)) };
  },

  // Created by AI.
  async consumeMfaVerification(userId: string, verificationToken: string, action: CriticalAction) {
    const challenge = await prisma.otp_challenge.findUnique({
      where: { challenge_hash: hashValue(verificationToken) },
    });
    if (
      !challenge ||
      challenge.usuario_id !== userId ||
      challenge.purpose !== OTP_PURPOSE.CRITICAL ||
      challenge.action !== action ||
      !challenge.verified_at ||
      challenge.consumed_at ||
      challenge.verified_at.getTime() < Date.now() - MFA_VERIFICATION_EXPIRATION_MINUTES * 60 * 1000
    ) {
      throw new AppError(401, 'Verificação adicional obrigatória ou expirada.');
    }
    await prisma.otp_challenge.update({
      where: { id: challenge.id },
      data: { consumed_at: new Date() },
    });
  },

  // Created by AI.
  // Rotates a one-time refresh token and invalidates the previous token.
  async refresh(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await prisma.refresh_token.findUnique({
      where: { token_hash: tokenHash },
      include: { usuario: true },
    });

    if (!storedToken || storedToken.expires_at <= new Date()) {
      throw new AppError(401, 'Refresh token inválido ou expirado.');
    }

    if (storedToken.revoked_at) {
      await prisma.refresh_token.updateMany({
        where: { usuario_id: storedToken.usuario_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new AppError(401, 'Refresh token reutilizado. Sessão revogada.');
    }

    if (storedToken.usuario.status !== 'Ativo') {
      throw new AppError(403, 'Usuário inativo. Contate o administrador.');
    }

    const accessToken = jwt.sign(
      {
        id: storedToken.usuario.id,
        email: storedToken.usuario.email,
        perfil: storedToken.usuario.perfil,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION } as SignOptions
    );
    const nextRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    const rotation = await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.refresh_token.updateMany({
        where: { id: storedToken.id, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      if (claimed.count === 0) {
        return null;
      }

      const created = await tx.refresh_token.create({
        data: {
          token_hash: hashRefreshToken(nextRefreshToken),
          usuario_id: storedToken.usuario_id,
          expires_at: createRefreshTokenExpiry(),
        },
      });
      await tx.refresh_token.update({
        where: { id: storedToken.id },
        data: { replaced_by: created.id },
      });
      return created;
    });

    if (!rotation) {
      await prisma.refresh_token.updateMany({
        where: { usuario_id: storedToken.usuario_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new AppError(401, 'Refresh token reutilizado. Sessão revogada.');
    }

    return { usuario: storedToken.usuario, token: accessToken, refreshToken: nextRefreshToken };
  },

  // Created by AI.
  async revokeRefreshToken(refreshToken: string) {
    const storedToken = await prisma.refresh_token.findUnique({
      where: { token_hash: hashRefreshToken(refreshToken) },
      select: { usuario_id: true },
    });

    if (storedToken) {
      await prisma.refresh_token.updateMany({
        where: { usuario_id: storedToken.usuario_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
  },

  // Updated by AI.
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
        cidadao: {
          select: {
            cpf: true, rua: true, numero: true, bairro: true, cidade: true,
            estado: true, cep: true, complemento: true, endereco: true,
            anonimizar_dados: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    return usuario;
  },

  // Created by AI.
  async updateProfile(userId: string, data: {
    nome: string;
    email: string;
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    complemento?: string | null;
  }) {
    const existingUser = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, perfil: true },
    });

    if (!existingUser) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    const updatedUser = await prisma.usuario.update({
      where: { id: userId },
      data: {
        nome: data.nome,
        email: data.email,
        ...(existingUser.perfil === 'Cidadao' && {
          cidadao: {
            upsert: {
              create: {
                rua: data.rua ?? null, numero: data.numero ?? null, bairro: data.bairro ?? null,
                cidade: data.cidade ?? null, estado: data.estado ?? null, cep: data.cep ?? null,
                complemento: data.complemento ?? null,
                endereco: `${data.rua ?? ''}, ${data.numero ?? ''}, ${data.bairro ?? ''}, ${data.cidade ?? ''} - ${data.estado ?? ''}, CEP ${data.cep ?? ''}${data.complemento ? `, ${data.complemento}` : ''}`,
              },
              update: {
                rua: data.rua ?? null, numero: data.numero ?? null, bairro: data.bairro ?? null,
                cidade: data.cidade ?? null, estado: data.estado ?? null, cep: data.cep ?? null,
                complemento: data.complemento ?? null,
                endereco: `${data.rua ?? ''}, ${data.numero ?? ''}, ${data.bairro ?? ''}, ${data.cidade ?? ''} - ${data.estado ?? ''}, CEP ${data.cep ?? ''}${data.complemento ? `, ${data.complemento}` : ''}`,
              },
            },
          },
        }),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        criadoem: true,
        cidadao: {
          select: {
            cpf: true, rua: true, numero: true, bairro: true, cidade: true,
            estado: true, cep: true, complemento: true, endereco: true,
            anonimizar_dados: true,
          },
        },
      },
    });

    return updatedUser;
  },

  // Created by AI.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    assertPasswordPolicy(newPassword);

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { senha: true },
    });

    if (!usuario || !(await bcrypt.compare(currentPassword, usuario.senha))) {
      throw new AppError(401, 'Senha atual inválida.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: userId },
        data: { senha: hashedPassword, tentativas_login_falhas: 0, bloqueado_ate: null },
      }),
      prisma.refresh_token.updateMany({
        where: { usuario_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
  },

  // Created by AI.
  async exportPersonalData(userId: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        criadoem: true,
        atualizadoem: true,
        cidadao: {
          select: {
            cpf: true, rua: true, numero: true, bairro: true, cidade: true,
            estado: true, cep: true, complemento: true,
            chamado: {
              select: {
                id: true,
                protocolo: true,
                descricao: true,
                endereco: true,
                latitude: true,
                longitude: true,
                status: true,
                criadoem: true,
                atualizadoem: true,
              },
              orderBy: { criadoem: 'desc' },
            },
          },
        },
      },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    return usuario;
  },

  // Created by AI.
  async deleteOrAnonymize(userId: string, password: string, mode: 'delete' | 'anonymize') {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, senha: true },
    });

    if (!usuario || !(await bcrypt.compare(password, usuario.senha))) {
      throw new AppError(401, 'Senha inválida.');
    }

    if (mode === 'delete') {
      await prisma.$transaction([
        prisma.refresh_token.deleteMany({ where: { usuario_id: userId } }),
        prisma.usuario.delete({ where: { id: userId } }),
      ]);
      return;
    }

    await prisma.$transaction([
      prisma.refresh_token.deleteMany({ where: { usuario_id: userId } }),
      prisma.usuario.update({
        where: { id: userId },
        data: {
          nome: 'Usuário anonimizado',
          email: `anon-${randomUUID()}@anonimizado.local`,
          senha: await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_COST),
          status: 'Inativo',
          cidadao: {
            upsert: {
              create: { cpf: null, rua: null, numero: null, bairro: null, cidade: null, estado: null, cep: null, complemento: null, endereco: null },
              update: { cpf: null, rua: null, numero: null, bairro: null, cidade: null, estado: null, cep: null, complemento: null, endereco: null },
            },

          },
        },
      }),
    ]);
  },

  // Created by AI.
  async setAnonymization(userId: string, enabled: boolean, password?: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { senha: true, cidadao: { select: { id: true } } },
    });
    if (!usuario) throw new AppError(404, 'Usuário não encontrado.');
    if (enabled && (!password || !(await bcrypt.compare(password, usuario.senha)))) {
      throw new AppError(401, 'Senha inválida.');
    }
    await prisma.cidadao.update({
      where: { id: userId },
      data: { anonimizar_dados: enabled },
    });
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