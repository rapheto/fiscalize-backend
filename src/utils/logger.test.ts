import { Writable } from 'stream';
import pino from 'pino';
import { REDACTED_PATHS, safeErrorInfo } from './logger';

// Created by AI.
// Monta um logger com a mesma configuração de mascaramento do logger real e
// captura a saída em memória.
function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const log = pino({ redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' } }, stream);
  return { log, output: () => lines.join('') };
}

// Created by AI.
describe('logger (RNF-SEC-16)', () => {
  it('mascara senha, token, e-mail e CPF na raiz e um nível abaixo', () => {
    const { log, output } = captureLogger();

    log.info({
      email: 'cidadao@example.com',
      senha: 'Senha@123',
      body: { cpf: '123.456.789-00', refreshToken: 'rt-abc', otp: '123456' },
      req: { headers: { authorization: 'Bearer eyJhbGciOi' } },
      userId: '6b1c0f1e-0000-4000-8000-000000000000',
    });

    const text = output();
    expect(text).not.toContain('cidadao@example.com');
    expect(text).not.toContain('Senha@123');
    expect(text).not.toContain('123.456.789-00');
    expect(text).not.toContain('rt-abc');
    expect(text).not.toContain('123456"');
    expect(text).not.toContain('eyJhbGciOi');
    expect(text).toContain('[REDACTED]');
    // O id interno continua visível para permitir a investigação.
    expect(text).toContain('6b1c0f1e-0000-4000-8000-000000000000');
  });

  it('safeErrorInfo descarta propriedades extras do erro', () => {
    const error = Object.assign(new Error('falha'), {
      meta: { target: ['email'], value: 'cidadao@example.com' },
      detail: 'Key (email)=(cidadao@example.com) already exists.',
    });

    const info = safeErrorInfo(error);

    expect(info.name).toBe('Error');
    expect(info.message).toBe('falha');
    expect(JSON.stringify(info)).not.toContain('cidadao@example.com');
  });

  it('safeErrorInfo registra só nome, código e modelo de erros do Prisma', () => {
    const error = Object.assign(
      new Error('Invalid `prisma.usuario.create()` invocation: { email: "cidadao@example.com" }'),
      { name: 'PrismaClientKnownRequestError', code: 'P2002', meta: { modelName: 'usuario', target: ['email'] } }
    );

    const info = safeErrorInfo(error);

    expect(info).toMatchObject({ name: 'PrismaClientKnownRequestError', code: 'P2002', model: 'usuario' });
    expect(info.message).toBeUndefined();
    expect(JSON.stringify(info)).not.toContain('cidadao@example.com');
  });

  it('safeErrorInfo não registra a pilha em produção', () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(safeErrorInfo(new Error('falha')).stack).toBeUndefined();
      process.env.NODE_ENV = 'development';
      expect(safeErrorInfo(new Error('falha')).stack).toBeDefined();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
