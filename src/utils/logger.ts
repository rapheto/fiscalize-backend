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
  | 'conta_bloqueada';

// Created by AI.
const securityLogger = logger.child({ category: 'security' });

// Created by AI.
// Registra um evento de segurança no log estruturado. Identifica o usuário só
// pelo id interno (UUID), nunca por e-mail, CPF ou nome. Não grava no banco,
// para não criar vínculo que impeça a exclusão da conta (RNF-SEC-08).
export function logSecurityEvent(
  event: SecurityEvent,
  data: { userId?: string; tentativas?: number } = {}
): void {
  securityLogger.warn({ event, ...data }, `Evento de segurança: ${event}`);
}

// Created by AI.
// Resumo seguro de um erro: nome, mensagem e pilha. Não inclui propriedades
// extras do objeto (por exemplo, `meta` do Prisma ou `detail` do pg), que podem
// trazer valores enviados pelo usuário.
export function safeErrorInfo(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack && { stack: error.stack }),
    };
  }
  return { name: typeof error, message: 'Erro não estruturado.' };
}
