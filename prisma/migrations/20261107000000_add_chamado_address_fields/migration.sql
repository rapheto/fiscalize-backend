-- Created by AI.
-- Endereço estruturado do chamado (snapshot no momento do registro).
ALTER TABLE "chamado"
  ADD COLUMN "cep" VARCHAR(9),
  ADD COLUMN "rua" VARCHAR(150),
  ADD COLUMN "numero" VARCHAR(20),
  ADD COLUMN "bairro" VARCHAR(100),
  ADD COLUMN "cidade" VARCHAR(100),
  ADD COLUMN "estado" VARCHAR(2),
  ADD COLUMN "complemento" VARCHAR(150);

-- Backfill mínimo para chamados antigos: reaproveita o endereço do cadastro
-- apenas para bairro/cidade/estado, que são as chaves do ETL.
UPDATE "chamado" AS c
SET
  "bairro" = NULLIF(UPPER(TRIM(cid."bairro")), ''),
  "cidade" = COALESCE(NULLIF(TRIM(c."cidade"), ''), NULLIF(TRIM(cid."cidade"), '')),
  "estado" = COALESCE(NULLIF(UPPER(TRIM(c."estado")), ''), NULLIF(UPPER(TRIM(cid."estado")), ''))
FROM "cidadao" AS cid
WHERE cid."id" = c."cidadaoid"
  AND c."bairro" IS NULL;

CREATE INDEX "idx_chamado_bairro" ON "chamado"("bairro");
