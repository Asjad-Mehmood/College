-- Several students recorded for one incident share an incident group (idempotent).
ALTER TABLE "violations" ADD COLUMN IF NOT EXISTS "incident_group" VARCHAR(36);
CREATE INDEX IF NOT EXISTS "violations_incident_group_idx" ON "violations"("incident_group");
