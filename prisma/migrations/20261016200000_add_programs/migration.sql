-- CreateTable
CREATE TABLE "programs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");


-- Starter programs, plus any program already used by a student.
INSERT INTO "programs" ("name") VALUES ('Medical'), ('ICS'), ('DIT'), ('I.Com'), ('FA') ON CONFLICT DO NOTHING;
INSERT INTO "programs" ("name") SELECT DISTINCT "program" FROM "students" ON CONFLICT DO NOTHING;
