-- CreateTable (idempotent so a retried deploy can't fail half-way)
CREATE TABLE IF NOT EXISTS "violation_attachments" (
    "id" SERIAL NOT NULL,
    "violation_id" INTEGER NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" VARCHAR(200),
    "uploaded_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "violation_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "violation_attachments_violation_id_idx" ON "violation_attachments"("violation_id");

DO $$ BEGIN
  ALTER TABLE "violation_attachments" ADD CONSTRAINT "violation_attachments_violation_id_fkey"
    FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
