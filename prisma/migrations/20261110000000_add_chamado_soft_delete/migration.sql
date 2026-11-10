-- Created by AI.
-- Soft delete dos chamados. Quando "excluidoem" está preenchido, o chamado
-- continua no banco para auditoria, mas não aparece mais nas consultas.
ALTER TABLE "chamado"
  ADD COLUMN "excluidoem" TIMESTAMP(6);

-- Saneamento único: os chamados legados sem bairro não podem ser cruzados
-- com clima/população nem aparecer no dashboard, então são soft-deleted.
UPDATE "chamado"
SET
  "excluidoem" = NOW(),
  "status" = 'Fechado',
  "atualizadoem" = NOW()
WHERE "excluidoem" IS NULL
  AND ("bairro" IS NULL OR TRIM("bairro") = '');

CREATE INDEX "idx_chamado_excluidoem" ON "chamado"("excluidoem");
