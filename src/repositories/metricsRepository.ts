import { prisma } from '../config/prisma';

type Scope = { orgaoid?: string };

// Created by AI.
// Chamados soft-deleted continuam no banco para auditoria, mas nunca entram
// nas métricas.
const NOT_DELETED = { excluidoem: null } as const;

export const metricsRepository = {
  // Updated by AI.
  async averageResponseTime(where: Scope) {
    return prisma.chamado.findMany({
      where: {
        ...where,
        ...NOT_DELETED,
        status: { in: ['Resolvido', 'Fechado'] },
      },
      select: {
        criadoem: true,
        timeline_event: {
          where: { tipo: 'status' },
          orderBy: { timestamp: 'asc' },
          select: { timestamp: true, dadosnovos: true },
        },
      },
    });
  },

  // Updated by AI.
  async demandsByCategory(where: Scope) {
    const [categorias, grupos] = await Promise.all([
      prisma.categoria.findMany({ select: { id: true, nome: true } }),
      prisma.chamado.groupBy({
        by: ['categoriaid'],
        where: { ...where, ...NOT_DELETED },
        _count: { id: true },
      }),
    ]);

    return { categorias, grupos };
  },

  // Updated by AI.
  async countByScope(where: Scope) {
    const scope = { ...where, ...NOT_DELETED };
    const [total, aberta, em_andamento, resolvida, encerrada] = await Promise.all([
      prisma.chamado.count({ where: scope }),
      prisma.chamado.count({ where: { ...scope, status: 'Aberto' } }),
      prisma.chamado.count({ where: { ...scope, status: 'Em_Andamento' } }),
      prisma.chamado.count({ where: { ...scope, status: 'Resolvido' } }),
      prisma.chamado.count({ where: { ...scope, status: 'Fechado' } }),
    ]);

    return { total, aberta, em_andamento, resolvida, encerrada };
  },
};
