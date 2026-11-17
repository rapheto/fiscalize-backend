import { z } from 'zod';
import { coordinate, integerId, text } from './fields';

// Created by AI.
// Schemas das rotas de denúncia usadas pelo app (RNF-SEC-13).
// Limites = tamanho das colunas da tabela chamado em prisma/schema.prisma.

// Created by AI.
// `descricao` é `text` sem limite no banco e o app não limita o campo. O teto
// existe só para impedir abuso; fica bem acima de qualquer relato realista.
export const DEMAND_DESCRIPTION_MAX = 5000;

// Created by AI.
const COORDINATE_MESSAGE = 'Coordenadas inválidas. Use a localização obtida pelo CEP ou pelo GPS.';

// Created by AI.
// POST /demands e PUT /demands/:id (o app envia o mesmo DemandInput nos dois).
export const demandSchema = z.looseObject({
  title: text('title', 100),
  description: text('description', DEMAND_DESCRIPTION_MAX),
  category_id: integerId('category_id deve ser um número inteiro.'),
  location: text('location', 255),
  cep: text('cep', 9),
  rua: text('rua', 150),
  numero: text('numero', 20),
  bairro: text('bairro', 100),
  cidade: text('cidade', 100),
  estado: text('estado', 2),
  complemento: text('complemento', 150),
  latitude: coordinate(COORDINATE_MESSAGE),
  longitude: coordinate(COORDINATE_MESSAGE),
});

// Created by AI.
// PATCH /demands/:id/status
export const demandStatusSchema = z.looseObject({
  status_id: text('status_id', 30, 'Status inválido.'),
});
