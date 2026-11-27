// Created by AI.
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

// Headers de segurança padrão do Helmet para todas as respostas da API (JSON).
const apiSecurityHeaders = helmet();

// A página /docs (Swagger UI) carrega scripts e estilos do unpkg.com e usa
// <script> e <style> inline. A CSP padrão do Helmet bloquearia tudo isso, então
// só essa rota recebe uma CSP mais permissiva. Os demais headers continuam iguais.
const docsSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'https://unpkg.com'],
      connectSrc: ["'self'"],
    },
  },
});

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/docs') {
    docsSecurityHeaders(req, res, next);
    return;
  }
  apiSecurityHeaders(req, res, next);
}
