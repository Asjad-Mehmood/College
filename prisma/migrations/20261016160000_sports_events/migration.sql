-- Teams are now per event (the college's team in each sport of an event).
-- The previous version of the sports module was never used, so its (empty)
-- team list is cleared first.
DELETE FROM "teams";

-- DropIndex
DROP INDEX "teams_sport_id_season_category_key";

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "active",
DROP COLUMN "category",
DROP COLUMN "coach",
DROP COLUMN "season",
ADD COLUMN     "event_id" INTEGER NOT NULL,
ADD COLUMN     "manager" VARCHAR(100);

-- CreateTable
CREATE TABLE "sports_events" (
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
CREATE INDEX "sports_events_start_date_idx" ON "sports_events"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "teams_event_id_sport_id_key" ON "teams"("event_id", "sport_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "sports_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

