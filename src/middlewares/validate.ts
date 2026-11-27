import { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errorMiddleware';

// Created by AI.
// RNF-SEC-13: valida req.body com um schema Zod antes do controller.
//
// - Só valida; não altera req.body. O controller recebe exatamente o que
//   recebia antes, então o comportamento das requisições válidas não muda.
// - Em caso de falha, responde 400 no formato atual ({ error, statusCode,
//   timestamp }) via AppError/errorMiddleware, com a mensagem do primeiro
//   problema encontrado.
// - Os schemas deixam campos ausentes ou vazios passarem: a obrigatoriedade
//   continua no controller, com as mensagens que o app e os testes já usam.
// - Corpo ausente ou em array (sem campos nomeados) é validado como objeto
//   vazio e segue para o controller, que responde como antes.
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const body: unknown = req.body ?? {};
    const result = schema.safeParse(Array.isArray(body) ? {} : body);
    if (result.success) {
      return next();
    }

    const issue = result.error.issues[0];
    const message =
      issue && issue.path.length > 0 ? issue.message : 'Corpo da requisição inválido.';
    return next(new AppError(400, message));
  };
}
