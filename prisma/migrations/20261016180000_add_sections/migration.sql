-- CreateEnum
CREATE TYPE "StudyYear" AS ENUM ('FIRST', 'SECOND');

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "year" "StudyYear",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sections_name_key" ON "sections"("name");


-- Sections already used by students become section records; the year is
-- left empty and can be set from the Students page.
INSERT INTO "sections" ("name") SELECT DISTINCT "section" FROM "students" ON CONFLICT DO NOTHING;
