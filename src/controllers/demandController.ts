import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { demandService } from '../services/demandService';
import { AppError } from '../middlewares/errorMiddleware';
import { isValidCoordinate, normalizeBairro } from '../utils/address';

// Created by AI.
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

// Created by AI.
function parseCoordinates(body: Record<string, unknown>): {
  latitude: number;
  longitude: number;
} {
  const hasLatitude = body['latitude'] !== undefined && body['latitude'] !== null && body['latitude'] !== '';
  const hasLongitude =
    body['longitude'] !== undefined && body['longitude'] !== null && body['longitude'] !== '';

  if (!hasLatitude || !hasLongitude) {
    throw new AppError(400, 'Latitude e longitude são obrigatórias.');
  }

  const latitude = Number(body['latitude']);
  const longitude = Number(body['longitude']);

  if (!isValidCoordinate(latitude, longitude)) {
    throw new AppError(400, 'Coordenadas inválidas. Use a localização obtida pelo CEP ou pelo GPS.');
  }

  return { latitude, longitude };
}

// Created by AI.
function structuredAddress(body: Record<string, unknown>) {
  return {
    cep: optionalText(body['cep']),
    rua: optionalText(body['rua']),
    numero: optionalText(body['numero']),
    bairro: optionalText(body['bairro']),
    cidade: optionalText(body['cidade']),
    estado: optionalText(body['estado']),
    complemento: optionalText(body['complemento']),
  };
}


export const demandController = {
  // Created by AI.
  async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page, limit } = req.query;
      const result = await demandService.listPublic(
        page ? Math.max(1, Number(page)) : 1,
        limit ? Math.min(100, Math.max(1, Number(limit))) : 20,
        status ? String(status) : undefined,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async listOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizations = await demandService.listOrganizations(req.user!.id, req.user!.perfil);
      res.status(200).json(organizations);
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as Record<string, unknown>;
      const { title, description, category_id, location } = body;

      if (!title || !description || !category_id) {
        throw new AppError(400, 'Campos obrigatórios: title, description, category_id');
      }

      const address = structuredAddress(body);
      if (!address.bairro) {
        throw new AppError(400, 'Bairro é obrigatório.');
      }

      const hasCompleteAddress =
        Boolean(address.rua) && Boolean(address.cidade) && Boolean(address.estado) && Boolean(address.cep);
      const legacyLocation = optionalText(location);

      if (!hasCompleteAddress && !legacyLocation) {
        throw new AppError(
          400,
          'Informe o endereço estruturado (rua, bairro, cidade, estado e CEP) ou location.'
        );
      }

      const { latitude, longitude } = parseCoordinates(body);

      const demand = await demandService.create({
        title: String(title),
        description: String(description),
        categoryId: Number(category_id),
        ...(legacyLocation && { location: legacyLocation }),
        cep: address.cep,
        rua: address.rua,
        numero: address.numero,
        bairro: normalizeBairro(address.bairro),
        cidade: address.cidade,
        estado: address.estado,
        complemento: address.complemento,
        latitude,
        longitude,
        userId: req.user!.id,
      });

      res.status(201).json(demand);
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, categoria, regiao, orgao, ordenacao, page, limit } = req.query;

      const result = await demandService.list({
        userId: req.user!.id,
        perfil: req.user!.perfil,
        ...(status !== undefined && { status: String(status) }),
        ...(categoria !== undefined && { categoria: Number(categoria) }),
        ...(regiao !== undefined && { regiao: String(regiao) }),
        ...(orgao !== undefined && { orgao: String(orgao) }),
        ...(ordenacao !== undefined && {
          ordenacao: String(ordenacao) as 'recent' | 'oldest' | 'priority' | 'sla',
        }),
        page: page ? Math.max(1, Number(page)) : 1,
        limit: limit ? Math.min(100, Math.max(1, Number(limit))) : 20,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const demand = await demandService.findById(id, req.user!.id, req.user!.perfil);
      res.status(200).json(demand);
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const body = req.body as Record<string, unknown>;
      const { title, description, location, category_id } = body;
      const address = structuredAddress(body);

      if (body['bairro'] !== undefined && !address.bairro) {
        throw new AppError(400, 'Bairro é obrigatório.');
      }

      const hasCoordinateInput = body['latitude'] !== undefined || body['longitude'] !== undefined;
      const coordinates = hasCoordinateInput ? parseCoordinates(body) : null;

      const demand = await demandService.update({
        id,
        userId: req.user!.id,
        ...(title !== undefined && { title: String(title) }),
        ...(description !== undefined && { description: String(description) }),
        ...(location !== undefined && { location: optionalText(location) }),
        ...(category_id !== undefined && { categoryId: Number(category_id) }),
        ...(address.cep !== null && { cep: address.cep }),
        ...(address.rua !== null && { rua: address.rua }),
        ...(address.numero !== null && { numero: address.numero }),
        ...(address.bairro !== null && { bairro: normalizeBairro(address.bairro) }),
        ...(address.cidade !== null && { cidade: address.cidade }),
        ...(address.estado !== null && { estado: address.estado }),
        ...(address.complemento !== null && { complemento: address.complemento }),
        ...(coordinates && {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }),
      });

      res.status(200).json(demand);
    } catch (error) {
      next(error);
    }
  },


async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'ID inválido');
    }

    const { status_id } = req.body;

    if (!status_id) {
      throw new AppError(400, 'status_id obrigatório');
    }

    const result = await demandService.updateStatus(
      id,
      req.user!.id,
      status_id
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
},

async delete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'ID inválido');
    }

    // Updated by AI.
    await demandService.deleteDemand(id, req.user!.id, req.user!.perfil);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
},

};
