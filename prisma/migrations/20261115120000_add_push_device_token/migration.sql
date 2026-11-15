-- Created by AI.
-- Adds the Expo push token columns to usuario_dispositivos.
-- Missing from the feature/notification-flow branch: 94c23ce changed
-- prisma/schema.prisma without a matching migration, so every query on this
-- table failed with Prisma P2022 (column does not exist).
ALTER TABLE "usuario_dispositivos"
  ADD COLUMN "push_token" VARCHAR(255),
  ADD COLUMN "push_token_updated_at" TIMESTAMPTZ(6);
