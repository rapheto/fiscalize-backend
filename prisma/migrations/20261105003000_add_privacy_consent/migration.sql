-- Created by AI.
CREATE TABLE "consentimentos_privacidade" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(40) NOT NULL DEFAULT 'politica_privacidade',
    "versao" VARCHAR(20) NOT NULL,
    "documento" VARCHAR(255) NOT NULL,
    "origem" VARCHAR(30) NOT NULL,
    "aceito_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consentimentos_privacidade_pkey" PRIMARY KEY ("id")
);

-- Created by AI.
CREATE INDEX "consentimentos_privacidade_usuario_id_aceito_em_idx"
ON "consentimentos_privacidade"("usuario_id", "aceito_em" DESC);

-- Created by AI.
ALTER TABLE "consentimentos_privacidade"
ADD CONSTRAINT "consentimentos_privacidade_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
