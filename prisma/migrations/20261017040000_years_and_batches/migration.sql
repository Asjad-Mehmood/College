-- Academic years and batches (idempotent).
CREATE TABLE IF NOT EXISTS "academic_years" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_name_key" ON "academic_years"("name");

CREATE TABLE IF NOT EXISTS "batches" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER NOT NULL,
    "passed_out" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "batches_name_key" ON "batches"("name");

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "batch_id" INTEGER;
CREATE INDEX IF NOT EXISTS "students_batch_id_idx" ON "students"("batch_id");
DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
