-- Clean up anything left behind by the short-lived "houses" version of the
-- sports module, on databases where it was applied. Safe to run anywhere.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'house_id') THEN
    -- One team per sport per event: fold duplicate (per-house) teams into the first one.
    CREATE TEMP TABLE team_keep ON COMMIT DROP AS
      SELECT id, MIN(id) OVER (PARTITION BY event_id, sport_id) AS keep_id FROM "teams";

    -- Move players to the kept team (skipping anyone already in it).
    UPDATE "team_members" m SET team_id = k.keep_id
      FROM team_keep k
      WHERE m.team_id = k.id AND k.id <> k.keep_id
        AND NOT EXISTS (SELECT 1 FROM "team_members" x WHERE x.team_id = k.keep_id AND x.roll_no = m.roll_no);
    UPDATE "achievements" a SET team_id = k.keep_id
      FROM team_keep k WHERE a.team_id = k.id AND k.id <> k.keep_id;
    DELETE FROM "teams" t USING team_keep k WHERE t.id = k.id AND k.id <> k.keep_id;

    ALTER TABLE "teams" DROP COLUMN "house_id" CASCADE;
  END IF;
END $$;

DROP TABLE IF EXISTS "houses" CASCADE;
DROP INDEX IF EXISTS "teams_event_id_sport_id_house_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "teams_event_id_sport_id_key" ON "teams"("event_id", "sport_id");
