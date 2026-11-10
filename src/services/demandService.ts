import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorMiddleware';
import { invalidateMetricsCache } from '../utils/cache';
import { composeAddress, normalizeBairro, normalizeCep } from '../utils/address';
import { prioridade, status_chamado } from '@prisma/client';

const STATUS_DISPLAY: Record<status_chamado, string> = {
  Aberto: 'Aberto',
  Em_An_lise: 'Em Análise',
  Em_Andamento: 'Em Andamento',
  Aguardando: 'Aguardando',
  Resolvido: 'Resolvido',
  Fechado: 'Fechado',
};

// Created by AI.
const STATUS_QUERY_VALUES: Record<string, status_chamado> = {
  Aberto: 'Aberto',
  'Em Análise': 'Em_An_lise',
  Em_An_lise: 'Em_An_lise',
  'Em Andamento': 'Em_Andamento',
  Em_Andamento: 'Em_Andamento',
  Aguardando: 'Aguardando',
  Resolvido: 'Resolvido',
  Fechado: 'Fechado',
};

// Created by AI.
const PRIORITY_DISPLAY: Record<prioridade, string> = {
  Baixa: 'Baixa',
  Media: 'Média',
  Alta: 'Alta',
  Critica: 'Crítica',
};

function displayStatus(s: status_chamado): string {
  return STATUS_DISPLAY[s] ?? s;
}

// Created by AI.
function displayPriority(p: prioridade): string {
  return PRIORITY_DISPLAY[p] ?? p;
}

// Created by AI.
interface UpdateDemandInput {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  location?: string | null;
  categoryId?: number;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  complemento?: string | null;
  latitude?: number;
  longitude?: number;
}

interface ListDemandsInput {
  userId: string;
  perfil: string;
  status?: string;
  categoria?: number;
  regiao?: string;
  orgao?: string;
  ordenacao?: 'recent' | 'oldest' | 'priority' | 'sla';
  page: number;
  limit: number;
}

// Created by AI.
export type PublicDemand = {
  id: string;
  protocolo: string;
  title: string;
  description: string;
  status: string;
  category: { id: number; nome: string };
  photoUrl: string | null;
  latitude: number;
  longitude: number;
  createdAt: Date;
};

const BLOCKED_STATUSES = ['Em_Andamento', 'Resolvido', 'Fechado'] as const;

// Created by AI.
interface CreateDemandInput {
  title: string;
  description: string;
  categoryId: number;
  location?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  complemento?: string | null;
  latitude: number;
  longitude: number;
  userId: string;
}

function generateProtocolo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEM-${date}-${rand}`;
}

async function resolveOrgan(categoryId: number): Promise<string | null> {
  const rule = await prisma.routing_rules.findFirst({
    where: { category_id: categoryId, active: true },
  });

  if (!rule) {
    console.warn(`[ROUTING] No active rule found for category_id: ${categoryId}`);
    return null;
  }

  return rule.organ_id;
}

// Updated by AI.
export const demandService = {
  // Created by AI.
  async listPublic(page: number, limit: number, status?: string) {
    const normalizedStatus = status ? STATUS_QUERY_VALUES[status] : undefined;
    // Updated by AI.
    const where = normalizedStatus
      ? { status: normalizedStatus, excluidoem: null }
      : { excluidoem: null };
    const [chamados, total] = await Promise.all([
      prisma.chamado.findMany({
        where,
        select: {
          id: true,
          protocolo: true,
          subcategoria: true,
          descricao: true,
          status: true,
          fotourl: true,
          latitude: true,
          longitude: true,
          criadoem: true,
          categoria: { select: { id: true, nome: true } },
        },
        orderBy: { criadoem: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chamado.count({ where }),
    ]);

    const data: PublicDemand[] = chamados.map((chamado) => ({
      id: chamado.id,
      protocolo: chamado.protocolo,
      title: chamado.subcategoria,
      description: chamado.descricao,
      status: displayStatus(chamado.status),
      category: chamado.categoria,
      photoUrl: chamado.fotourl,
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      createdAt: chamado.criadoem,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async list(input: ListDemandsInput) {
    const { userId, perfil, status, categoria, regiao, orgao, ordenacao, page, limit } = input;

    // Updated by AI.
    const where: Record<string, unknown> = { excluidoem: null };

    if (perfil === 'Cidadao') where['cidadaoid'] = userId;
    if (status) where['status'] = STATUS_QUERY_VALUES[status] ?? status;
    if (categoria) where['categoriaid'] = categoria;
    if (regiao) {
      where['OR'] = [
        { endereco: { contains: regiao, mode: 'insensitive' } },
        { protocolo: { contains: regiao, mode: 'insensitive' } },
      ];
    }
    if (orgao) where['orgaoid'] = orgao;

    const include = {
      categoria: { select: { id: true, nome: true } },
      orgao: { select: { id: true, nome: true, sigla: true } },
      cidadao: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      },
    };

    const [chamados, total] = await Promise.all([
      prisma.chamado.findMany({
        where,
        include,
        orderBy:
          ordenacao === 'oldest'
            ? { criadoem: 'asc' }
            : ordenacao === 'priority'
              ? { prioridade: 'asc' }
              : ordenacao === 'sla'
                ? { sladeadline: 'asc' }
                : { criadoem: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chamado.count({ where }),
    ]);

    return {
      data: chamados.map((c) => ({
        id: c.id,
        protocolo: c.protocolo,
        title: c.subcategoria,
        description: c.descricao,
        status: displayStatus(c.status),
        location: c.endereco,
        cep: c.cep,
        rua: c.rua,
        numero: c.numero,
        bairro: c.bairro,
        cidade: c.cidade,
        estado: c.estado,
        complemento: c.complemento,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        category: c.categoria,
        assignedOrg: c.orgao
          ? { id: c.orgao.id, nome: c.orgao.nome, sigla: c.orgao.sigla }
          : null,
        priority: displayPriority(c.prioridade),
        creator: c.cidadao.usuario,
        createdAt: c.criadoem,
        updatedAt: c.atualizadoem,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // Created by AI.
  async listOrganizations(userId: string, perfil: string) {
    // Updated by AI.
    const where =
      perfil === 'Cidadao'
        ? { cidadaoid: userId, excluidoem: null }
        : { excluidoem: null };
    const demands = await prisma.chamado.findMany({
      where: { ...where, orgaoid: { not: null } },
      distinct: ['orgaoid'],
      select: { orgao: { select: { id: true, nome: true, sigla: true } } },
    });

    return demands.flatMap((demand) => (demand.orgao ? [demand.orgao] : []));
  },

  // Updated by AI.
  async findById(id: string, userId: string, perfil: string) {
    // Updated by AI.
    const chamado = await prisma.chamado.findFirst({
      where: { id, excluidoem: null },
      include: {
        categoria: { select: { id: true, nome: true } },
        orgao: { select: { id: true, nome: true, sigla: true } },
        cidadao: {
          include: { usuario: { select: { id: true, nome: true, email: true } } },
        },
        timeline_event: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            tipo: true,
            titulo: true,
            descricao: true,
            autor: true,
            timestamp: true,
          },
        },
      },
    });

    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    if (perfil === 'Cidadao' && chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para acessar esta demanda.');
    }

    return {
      id: chamado.id,
      protocolo: chamado.protocolo,
      title: chamado.subcategoria,
      description: chamado.descricao,
      status: displayStatus(chamado.status),
      location: chamado.endereco,
      cep: chamado.cep,
      rua: chamado.rua,
      numero: chamado.numero,
      bairro: chamado.bairro,
      cidade: chamado.cidade,
      estado: chamado.estado,
      complemento: chamado.complemento,
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      category: chamado.categoria,
      creator: chamado.cidadao.usuario,
      createdAt: chamado.criadoem,
      updatedAt: chamado.atualizadoem,
      assignedOrg: chamado.orgao
        ? {
            id: chamado.orgao.id,
            nome: chamado.orgao.nome,
            sigla: chamado.orgao.sigla,
          }
        : null,
      priority: displayPriority(chamado.prioridade),
      slaHours: chamado.slahoras,
      slaDeadline: chamado.sladeadline,
      slaJustification: chamado.slajustification,
      photoUrl: chamado.fotourl,
      resolutionNote: chamado.resolutionnote,
      resolutionPhotoUrl: chamado.resolutionphotourl,
      logs: chamado.timeline_event,
    };
  },

  // Updated by AI.
  async update(input: UpdateDemandInput) {
    const {
      id,
      userId,
      title,
      description,
      location,
      categoryId,
      cep,
      rua,
      numero,
      bairro,
      cidade,
      estado,
      complemento,
      latitude,
      longitude,
    } = input;

    // 1. Find demand
    // Updated by AI.
    const chamado = await prisma.chamado.findFirst({
      where: { id, excluidoem: null },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    // 2. Ownership check
    if (chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para editar esta demanda.');
    }

    // 3. Status check
    if ((BLOCKED_STATUSES as readonly string[]).includes(chamado.status)) {
      throw new AppError(403, `Não é possível editar uma demanda com status '${chamado.status}'.`);
    }

    // 4. If category_id provided, validate and re-resolve org/prioridade/slahoras
    let orgaoid = chamado.orgaoid;
    let prioridade = chamado.prioridade;
    let slahoras = chamado.slahoras;

    if (categoryId !== undefined) {
      const categoria = await prisma.categoria.findUnique({ where: { id: categoryId } });
      if (!categoria || !categoria.ativo) {
        throw new AppError(400, `Categoria inválida: categoria ${categoryId} não encontrada ou inativa.`);
      }

      const regra = await prisma.regra_competencia.findFirst({
        where: { categoriaid: categoryId, subcategoria: title ?? chamado.subcategoria },
      });

      if (regra) {
        orgaoid = regra.orgaoprincipalid;
        prioridade = regra.prioridade;
        slahoras = regra.slahoras;
      } else {
        const orgaoCategoria = await prisma.orgao_categoria.findFirst({
          where: { categoriaid: categoryId },
          include: { orgao: true },
        });
        if (orgaoCategoria) {
          orgaoid = orgaoCategoria.orgaoid;
          slahoras = orgaoCategoria.orgao.slahoras;
        } else {
          const orgao = await prisma.orgao.findFirst({ where: { status: 'Ativo' } });
          if (!orgao) throw new AppError(500, 'Nenhum órgão responsável encontrado no sistema.');
          orgaoid = orgao.id;
          slahoras = orgao.slahoras;
        }
      }
    }

    // 5. Atualiza chamado + log timeline_event atomicamente
    const hasAddressUpdate = [cep, rua, numero, bairro, cidade, estado, complemento].some(
      (value) => value !== undefined
    );
    const nextAddress = {
      cep: cep !== undefined ? cep : chamado.cep,
      rua: rua !== undefined ? rua : chamado.rua,
      numero: numero !== undefined ? numero : chamado.numero,
      bairro: bairro !== undefined ? normalizeBairro(bairro) : chamado.bairro,
      cidade: cidade !== undefined ? cidade : chamado.cidade,
      estado: estado !== undefined ? estado : chamado.estado,
      complemento: complemento !== undefined ? complemento : chamado.complemento,
    };
    const nextEndereco =
      location !== undefined
        ? location?.trim() || composeAddress(nextAddress)
        : hasAddressUpdate
          ? composeAddress(nextAddress)
          : chamado.endereco;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.chamado.update({
        where: { id },
        data: {
          ...(title !== undefined && { subcategoria: title }),
          ...(description !== undefined && { descricao: description }),
          ...((location !== undefined || hasAddressUpdate) && { endereco: nextEndereco }),
          ...(cep !== undefined && { cep: normalizeCep(cep) }),
          ...(rua !== undefined && { rua: rua ?? null }),
          ...(numero !== undefined && { numero: numero ?? null }),
          ...(bairro !== undefined && { bairro: normalizeBairro(bairro) }),
          ...(cidade !== undefined && { cidade: cidade ?? null }),
          ...(estado !== undefined && { estado: estado?.toUpperCase() ?? null }),
          ...(complemento !== undefined && { complemento: complemento ?? null }),
          ...(categoryId !== undefined && { categoriaid: categoryId }),
          ...(latitude !== undefined && { latitude }),
          ...(longitude !== undefined && { longitude }),
          orgaoid,
          prioridade,
          slahoras,
          atualizadoem: new Date(),
        },
        include: { categoria: { select: { id: true, nome: true } } },
      });

      const usuario = await tx.usuario.findUnique({
        where: { id: userId },
        select: { nome: true },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: id,
          tipo: 'mensagem',
          titulo: 'Demanda atualizada',
          descricao: 'Dados da demanda foram atualizados pelo cidadão.',
          autor: usuario?.nome ?? 'Cidadão',
          dadosantigos: {
            subcategoria: chamado.subcategoria,
            descricao: chamado.descricao,
            endereco: chamado.endereco,
            bairro: chamado.bairro,
            cep: chamado.cep,
            rua: chamado.rua,
            numero: chamado.numero,
            cidade: chamado.cidade,
            estado: chamado.estado,
            complemento: chamado.complemento,
            latitude: chamado.latitude,
            longitude: chamado.longitude,
            categoriaid: chamado.categoriaid,
          },
          dadosnovos: {
            subcategoria: title ?? chamado.subcategoria,
            descricao: description ?? chamado.descricao,
            endereco: nextEndereco,
            bairro: nextAddress.bairro,
            cep: nextAddress.cep,
            rua: nextAddress.rua,
            numero: nextAddress.numero,
            cidade: nextAddress.cidade,
            estado: nextAddress.estado,
            complemento: nextAddress.complemento,
            latitude: latitude ?? chamado.latitude,
            longitude: longitude ?? chamado.longitude,
            categoriaid: categoryId ?? chamado.categoriaid,
          },
        },
      });

      return result;
    });

    if (categoryId !== undefined) {
      await invalidateMetricsCache(chamado.gestorid);
    }

    return {
      id: updated.id,
      protocolo: updated.protocolo,
      title: updated.subcategoria,
      description: updated.descricao,
      category: updated.categoria,
      location: updated.endereco,
      cep: updated.cep,
      rua: updated.rua,
      numero: updated.numero,
      bairro: updated.bairro,
      cidade: updated.cidade,
      estado: updated.estado,
      complemento: updated.complemento,
      latitude: Number(updated.latitude),
      longitude: Number(updated.longitude),
      status: displayStatus(updated.status),
      createdAt: updated.criadoem,
      updatedAt: updated.atualizadoem,
    };
  },

  // Updated by AI.
  async create(input: CreateDemandInput) {
    const {
      title,
      description,
      categoryId,
      location,
      cep,
      rua,
      numero,
      bairro,
      cidade,
      estado,
      complemento,
      latitude,
      longitude,
      userId,
    } = input;
    const endereco = location?.trim() || composeAddress(input);

    // 1. Validate category exists and is active
    const categoria = await prisma.categoria.findUnique({ where: { id: categoryId } });
    if (!categoria || !categoria.ativo) {
      throw new AppError(400, `Categoria inválida: categoria ${categoryId} não encontrada ou inativa.`);
    }

    // 2. Verify user has a cidadao profile
    const cidadao = await prisma.cidadao.findUnique({ where: { id: userId } });
    if (!cidadao) {
      throw new AppError(403, 'Usuário não possui perfil de cidadão para registrar demandas.');
    }

    // 3. Resolve orgaoid, prioridade, slahoras via regra_competencia → orgao_categoria fallback
    let orgaoid: string | null = null;
    let prioridade: 'Baixa' | 'Media' | 'Alta' | 'Critica' = 'Media';
    let slahoras = 48;

    // Exact subcategoria match first, then any rule for this category
    const regra = await prisma.regra_competencia.findFirst({
      where: { categoriaid: categoryId, subcategoria: title },
    }) ?? await prisma.regra_competencia.findFirst({
      where: { categoriaid: categoryId },
    });

    if (regra) {
      orgaoid = regra.orgaoprincipalid;
      prioridade = regra.prioridade as typeof prioridade;
      slahoras = regra.slahoras;
    } else {
      // No routing rule — fall back to orgao_categoria
      const oc = await prisma.orgao_categoria.findFirst({
        where: { categoriaid: categoryId },
        include: { orgao: { select: { id: true, slahoras: true } } },
      });
      if (oc) {
        orgaoid = oc.orgaoid;
        slahoras = oc.orgao.slahoras;
      } else {
        console.warn(`[ROUTING] No rule or orgao_categoria found for categoryId: ${categoryId}`);
      }
    }

    const protocolo = generateProtocolo();
    const sladeadline = new Date(Date.now() + slahoras * 60 * 60 * 1000);

    // 4. Create chamado + timeline_event atomically
    const chamado = await prisma.$transaction(async (tx) => {
      const created = await tx.chamado.create({
        data: {
          protocolo,
          descricao: description,
          cidadaoid: userId,
          orgaoid,
          categoriaid: categoryId,
          subcategoria: title,
          endereco,
          cep: normalizeCep(cep),
          rua: rua ?? null,
          numero: numero ?? null,
          bairro: normalizeBairro(bairro),
          cidade: cidade ?? null,
          estado: estado?.toUpperCase() ?? null,
          complemento: complemento ?? null,
          latitude,
          longitude,
          prioridade,
          slahoras,
          sladeadline,
        },
        include: {
          categoria: { select: { id: true, nome: true } },
        },
      });

      const usuario = await tx.usuario.findUnique({
        where: { id: userId },
        select: { nome: true },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: created.id,
          tipo: 'criacao',
          titulo: 'Demanda registrada',
          descricao: 'Demanda urbana registrada pelo cidadão.',
          autor: usuario?.nome ?? 'Cidadão',
        },
      });

      return created;
    });

    await invalidateMetricsCache(chamado.gestorid);

    return {
      id: chamado.id,
      protocolo: chamado.protocolo,
      title: chamado.subcategoria,
      description: chamado.descricao,
      category: chamado.categoria,
      location: chamado.endereco,
      cep: chamado.cep,
      rua: chamado.rua,
      numero: chamado.numero,
      bairro: chamado.bairro,
      cidade: chamado.cidade,
      estado: chamado.estado,
      complemento: chamado.complemento,
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      status: displayStatus(chamado.status),
      createdAt: chamado.criadoem,
    };
  },

  async updateStatus(chamadoId: string, userId: string, newStatus: any) {
    // Updated by AI.
    const chamado = await prisma.chamado.findFirst({
      where: { id: chamadoId, excluidoem: null },
    });

    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    const validStatuses = [
      'Aberto',
      'Em_An_lise',
      'Em_Andamento',
      'Aguardando',
      'Resolvido',
      'Fechado',
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new AppError(400, `Status inválido.`);
    }

    const oldStatus = chamado.status;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.chamado.update({
        where: { id: chamadoId },
        data: {
          status: newStatus,
          atualizadoem: new Date(),
        },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: chamadoId,
          tipo: 'status',
          titulo: 'Status atualizado',
          descricao: `Status alterado de ${oldStatus} para ${newStatus}`,
          autor: userId,
          dadosantigos: { status: oldStatus },
          dadosnovos: { status: newStatus },
        },
      });

      return result;
    });

    await invalidateMetricsCache(chamado.gestorid);

    return {
      id: updated.id,
      status: displayStatus(updated.status),
      updatedAt: updated.atualizadoem,
    };
  },

  // Updated by AI.
  // Called by DELETE /demands/:id. A Cidadao may only delete his own demand;
  // a Gestor (or Admin) may delete any.
  async deleteDemand(chamadoId: string, userId: string, perfil?: string) {
    // Updated by AI.
    const chamado = await prisma.chamado.findFirst({
      where: { id: chamadoId, excluidoem: null },
    });

    if (!chamado) {
      throw new AppError(404, 'Demanda não encontrada.');
    }

    if (perfil !== 'Gestor' && perfil !== 'Admin' && chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para excluir esta demanda.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.chamado.update({
        where: { id: chamadoId },
        data: {
          status: 'Fechado',
          // Updated by AI.
          excluidoem: new Date(),
        },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: chamadoId,
          tipo: 'transferencia',
          titulo: 'Demanda removida',
          descricao: 'Demanda marcada como excluída (soft delete).',
          autor: userId,
          dadosantigos: { status: chamado.status },
          dadosnovos: { status: 'Fechado' },
        },
      });
    });

    await invalidateMetricsCache(chamado.gestorid);
  },
}
