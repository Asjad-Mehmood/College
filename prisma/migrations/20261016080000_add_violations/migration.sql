-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MAJOR', 'SEVERE');

-- CreateEnum
CREATE TYPE "ViolationAction" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'FINE', 'PARENT_CALLED', 'PARENT_MEETING', 'DETENTION', 'SUSPENSION', 'REFERRED_TO_COMMITTEE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "violation_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MINOR',
    "default_fine_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" SERIAL NOT NULL,
    "roll_no" VARCHAR(20) NOT NULL,
    "type_id" INTEGER NOT NULL,
    "severity" "Severity" NOT NULL,
    "incident_date" DATE NOT NULL,
    "incident_time" VARCHAR(5),
    "location" VARCHAR(100),
    "description" TEXT NOT NULL,
    "reported_by" VARCHAR(100),
    "action_taken" "ViolationAction" NOT NULL DEFAULT 'VERBAL_WARNING',
    "suspension_days" INTEGER,
    "fine_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fine_paid" BOOLEAN NOT NULL DEFAULT false,
    "fine_paid_at" TIMESTAMPTZ(3),
    "parent_notified" BOOLEAN NOT NULL DEFAULT false,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(3),
    "closing_note" VARCHAR(300),
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "violation_types_name_key" ON "violation_types"("name");

-- CreateIndex
CREATE INDEX "violations_incident_date_idx" ON "violations"("incident_date");

-- CreateIndex
CREATE INDEX "violations_roll_no_idx" ON "violations"("roll_no");

-- CreateIndex
CREATE INDEX "violations_status_idx" ON "violations"("status");

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "violation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Default violation types; the Discipline In-Charge can edit or add more in Settings.
INSERT INTO "violation_types" ("name", "severity", "default_fine_amount") VALUES
  ('Uniform / dress code', 'MINOR', 0),
  ('Mobile phone in class', 'MINOR', 200),
  ('Bunking class', 'MINOR', 0),
  ('Littering / smoking on campus', 'MAJOR', 500),
  ('Misbehaviour with staff', 'MAJOR', 0),
  ('Damage to college property', 'MAJOR', 0),
  ('Unfair means in exam', 'SEVERE', 0),
  ('Fighting / violence', 'SEVERE', 0),
  ('Harassment / bullying', 'SEVERE', 0),
  ('Other', 'MINOR', 0);
