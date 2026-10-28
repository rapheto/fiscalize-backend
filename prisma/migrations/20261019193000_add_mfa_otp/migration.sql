CREATE TABLE "usuario_dispositivos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuario_id" UUID NOT NULL,
    "device_hash" VARCHAR(64) NOT NULL,
    "device_name" VARCHAR(120),
    "trusted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuario_dispositivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuario_dispositivos_usuario_id_device_hash_key"
  ON "usuario_dispositivos"("usuario_id", "device_hash");
CREATE INDEX "usuario_dispositivos_usuario_id_idx" ON "usuario_dispositivos"("usuario_id");

ALTER TABLE "usuario_dispositivos"
  ADD CONSTRAINT "usuario_dispositivos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuario_id" UUID NOT NULL,
    "challenge_hash" VARCHAR(64) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "action" VARCHAR(32),
    "device_hash" VARCHAR(64),
    "device_name" VARCHAR(120),
    "destination" VARCHAR(160) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "otp_challenges_challenge_hash_key" ON "otp_challenges"("challenge_hash");
CREATE INDEX "otp_challenges_usuario_id_purpose_created_at_idx"
  ON "otp_challenges"("usuario_id", "purpose", "created_at");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
