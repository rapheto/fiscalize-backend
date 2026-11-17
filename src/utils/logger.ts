import pino from 'pino';

// Created by AI.
// Campos sensíveis mascarados automaticamente em qualquer objeto registrado
// (RNF-SEC-16). O pino aceita caminho exato ou curinga de um nível (`*.campo`),
// então cada campo aparece na raiz e um nível abaixo.
const SENSITIVE_FIELDS = [
  'senha',
  'password',
  'novaSenha',
  'senhaAtual',
  'token',
  'accessToken',
  'refreshToken',
  'refresh_token',
  'challengeToken',
  'authorization',
  'cookie',
  'email',
  'cpf',
  'otp',
  'codigo',
] as const;

// Created by AI.
export const REDACTED_PATHS: string[] = [
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
  'req.headers.authorization',
  'req.headers.cookie',
];

// Created by AI.
// Logger estruturado (JSON em stdout, coletado pela plataforma de hospedagem).
// Nível configurável por LOG_LEVEL; padrão "info".
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'fiscalize-backend' },
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
});

// Created by AI.
// Eventos de segurança auditados (RNF-SEC-16).
export type SecurityEvent =
  | 'login_falha'
  | 'login_usuario_inexistente'
  | 'login_usuario_inativo'
  | 'login_conta_bloqueada'
  | 'conta_bloqueada'
  | 'otp_falha'
  | 'otp_esgotado';

// Created by AI.
const securityLogger = logger.child({ category: 'security' });

// Created by AI.
// Registra um evento de segurança no log estruturado. Identifica o usuário só
// pelo id interno (UUID), nunca por e-mail, CPF ou nome. Não grava no banco,
// para não criar vínculo que impeça a exclusão da conta (RNF-SEC-08).
export function logSecurityEvent(
  event: SecurityEvent,
  data: { userId?: string; tentativas?: number; finalidade?: string } = {}
): void {
  securityLogger.warn({ event, ...data }, `Evento de segurança: ${event}`);
}

// Created by AI.
export interface SafeErrorInfo {
  name: string;
  message?: string;
  code?: string;
  model?: string;
  stack?: string;
}

// Created by AI.
// Resumo seguro de um erro para log. Nunca inclui propriedades extras do
// objeto (por exemplo, `detail` do pg), que podem trazer valores enviados pelo
// usuário.
// - Erros do Prisma (PrismaClient*): só nome, código e modelo. A mensagem do
//   Prisma pode reproduzir os argumentos da consulta, inclusive dados pessoais.
// - Demais erros: nome e mensagem.
// - A pilha só é registrada fora de produção.
export function safeErrorInfo(error: unknown): SafeErrorInfo {
  if (!(error instanceof Error)) {
    return { name: typeof error, message: 'Erro não estruturado.' };
  }

  const includeStack = process.env.NODE_ENV !== 'production' && Boolean(error.stack);

  if (error.name.startsWith('PrismaClient')) {
    const prismaError = error as Error & { code?: unknown; meta?: { modelName?: unknown } };
    // As primeiras linhas da pilha repetem "Nome: mensagem"; ficam só os frames.
    const frames = (error.stack ?? '')
      .split('\n')
      .filter((line) => /^\s+at /.test(line))
      .join('\n');
    return {
      name: error.name,
      ...(typeof prismaError.code === 'string' && { code: prismaError.code }),
      ...(typeof prismaError.meta?.modelName === 'string' && { model: prismaError.meta.modelName }),
      ...(includeStack && frames && { stack: frames }),
    };
  }

  return {
    name: error.name,
    message: error.message,
    ...(includeStack && { stack: error.stack as string }),
  };
}
