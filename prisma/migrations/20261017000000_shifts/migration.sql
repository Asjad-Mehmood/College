-- Morning and evening shifts (idempotent).
DO $$ BEGIN
  CREATE TYPE "Shift" AS ENUM ('MORNING', 'EVENING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "shift" "Shift" NOT NULL DEFAULT 'MORNING';
ALTER TABLE "portal_settings" ADD COLUMN IF NOT EXISTS "evening_summer_start_time" VARCHAR(5) NOT NULL DEFAULT '13:30';
ALTER TABLE "portal_settings" ADD COLUMN IF NOT EXISTS "evening_winter_start_time" VARCHAR(5) NOT NULL DEFAULT '13:00';
