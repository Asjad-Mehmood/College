-- Uploaded student photos (idempotent).
CREATE TABLE IF NOT EXISTS "student_photos" (
    "roll_no" VARCHAR(20) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_photos_pkey" PRIMARY KEY ("roll_no")
);

DO $$ BEGIN
  ALTER TABLE "student_photos" ADD CONSTRAINT "student_photos_roll_no_fkey"
    FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
