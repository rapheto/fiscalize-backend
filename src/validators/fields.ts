import { z } from 'zod';

// Created by AI.
// Blocos de validação reutilizados pelos schemas (RNF-SEC-13).
//
// Regra comum: valor ausente, null ou string vazia sempre passa. Quem decide se
// o campo é obrigatório é o controller, que já tem as mensagens usadas pelo app.
// O Zod rejeita só o que hoje vira erro 500 ou dado corrompido: tipo errado
// (objeto, array, booleano) e texto maior que a coluna do banco.
export const empty = z.union([z.literal(''), z.null(), z.undefined()]);

// Created by AI.
// Texto com limite de tamanho. Aceita número porque os controllers convertem
// com String() e clientes podem enviar, por exemplo, numero: 123.
export function text(field: string, max: number, message?: string) {
  const error = message ?? `${field} deve ser texto com até ${max} caracteres.`;
  return z
    .union([empty, z.string().max(max, { error }), z.number()], { error })
    .optional();
}

// Created by AI.
// Texto sem conversão de número (senhas e tokens).
export function stringOnly(message: string) {
  return z.union([empty, z.string()], { error: message }).optional();
}

// Created by AI.
// Identificador inteiro, como número ou string de dígitos. Não exige valor
// positivo: 0 e negativos continuam chegando ao controller e ao service, que já
// respondem com as mensagens atuais ("Campos obrigatórios..." ou "Categoria
// inválida..."). Rejeita só o que hoje vira 500 (texto, fração, objeto).
export function integerId(message: string) {
  return z
    .union(
      [empty, z.number().int({ error: message }), z.string().regex(/^-?\d+$/, { error: message })],
      { error: message }
    )
    .optional();
}

// Created by AI.
// Coordenada como número ou string. A faixa (-90..90, -180..180) continua sendo
// conferida no controller (isValidCoordinate).
export function coordinate(message: string) {
  return z
    .union([empty, z.number(), z.string().max(50, { error: message })], { error: message })
    .optional();
}
