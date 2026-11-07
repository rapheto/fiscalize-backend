import { Pool } from 'pg';
import { ETL_DATABASE_URL } from '../config/env';

// Created by AI.
export type EtlDashboardRow = {
  bairro: string | null;
  chamados: number;
  populacao: number | null;
  chamados_por_1000: number | null;
};

// Created by AI.
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Created by AI.
export const etlDashboardService = {
  async listPopulation(): Promise<EtlDashboardRow[]> {
    if (!ETL_DATABASE_URL) {
      throw new Error(
        'ETL_DATABASE_URL não está configurada. Informe a conexão do Neon que contém chamados_populacao.'
      );
    }

    const pool = new Pool({ connectionString: ETL_DATABASE_URL });
    try {
      const result = await pool.query<{
        bairro: string | null;
        chamados: unknown;
        populacao: unknown;
        chamados_por_1000: unknown;
      }>(
        `SELECT bairro, chamados, populacao, chamados_por_1000
         FROM chamados_populacao
         ORDER BY chamados DESC, bairro ASC`,
      );

      return result.rows.map((row) => ({
        bairro: row.bairro,
        chamados: toNumberOrNull(row.chamados) ?? 0,
        populacao: toNumberOrNull(row.populacao),
        chamados_por_1000: toNumberOrNull(row.chamados_por_1000),
      }));
    } finally {
      await pool.end();
    }
  },
};
