-- Teams are now per event (the college's team in each sport of an event).
-- The previous version of the sports module was never used, so its (empty)
-- team list is cleared first.
DELETE FROM "teams";

-- DropIndex
DROP INDEX IF EXISTS "teams_sport_id_season_category_key";

-- AlterTable
ALTER TABLE "teams" DROP COLUMN IF EXISTS "active",
DROP COLUMN IF EXISTS "category",
DROP COLUMN IF EXISTS "coach",
DROP COLUMN IF EXISTS "season",
ADD COLUMN IF NOT EXISTS     "event_id" INTEGER NOT NULL,
ADD COLUMN IF NOT EXISTS     "manager" VARCHAR(100);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sports_events" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "venue" VARCHAR(100),
    "notes" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sports_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sports_events_start_date_idx" ON "sports_events"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "teams_event_id_sport_id_key" ON "teams"("event_id", "sport_id");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_event_id_fkey') THEN ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "sports_events"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

