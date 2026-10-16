-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GATE', 'PRINCIPAL');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'STRUCK_OFF', 'GRADUATED');

-- CreateEnum
CREATE TYPE "LateReason" AS ENUM ('TRANSPORT', 'TRAFFIC', 'MEDICAL', 'WEATHER', 'NO_EXCUSE');

-- CreateEnum
CREATE TYPE "DisciplineAction" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'ID_CONFISCATED', 'FINE', 'PARENT_CALLED', 'DETENTION', 'PARENT_MEETING');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('NONE', 'HELD', 'RETURNED');

-- CreateEnum
CREATE TYPE "Schedule" AS ENUM ('SUMMER', 'WINTER');

-- CreateTable
CREATE TABLE "students" (
    "roll_no" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "father_name" VARCHAR(100) NOT NULL,
    "program" VARCHAR(50) NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "student_phone" VARCHAR(20),
    "parent_phone" VARCHAR(20) NOT NULL,
    "photo_url" VARCHAR(255),
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("roll_no")
);

-- CreateTable
CREATE TABLE "late_records" (
    "id" SERIAL NOT NULL,
    "roll_no" VARCHAR(20) NOT NULL,
    "late_date" DATE NOT NULL,
    "arrived_at" TIMESTAMPTZ(3) NOT NULL,
    "minutes_late" INTEGER NOT NULL,
    "reason" "LateReason" NOT NULL,
    "action_taken" "DisciplineAction" NOT NULL DEFAULT 'VERBAL_WARNING',
    "id_card_status" "CardStatus" NOT NULL DEFAULT 'NONE',
    "card_returned_at" TIMESTAMPTZ(3),
    "card_return_note" VARCHAR(200),
    "fine_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fine_paid" BOOLEAN NOT NULL DEFAULT false,
    "fine_paid_at" TIMESTAMPTZ(3),
    "parent_notified" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "college_name" VARCHAR(150) NOT NULL DEFAULT 'Government College',
    "college_address" VARCHAR(255) NOT NULL DEFAULT '',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
    "schedule" "Schedule" NOT NULL DEFAULT 'SUMMER',
    "summer_start_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "winter_start_time" VARCHAR(5) NOT NULL DEFAULT '08:30',
    "grace_period_mins" INTEGER NOT NULL DEFAULT 10,
    "habitual_threshold" INTEGER NOT NULL DEFAULT 3,
    "critical_threshold" INTEGER NOT NULL DEFAULT 5,
    "default_fine_amount" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_program_section_idx" ON "students"("program", "section");

-- CreateIndex
CREATE INDEX "late_records_late_date_idx" ON "late_records"("late_date");

-- CreateIndex
CREATE INDEX "late_records_id_card_status_idx" ON "late_records"("id_card_status");

-- CreateIndex
CREATE UNIQUE INDEX "late_records_roll_no_late_date_key" ON "late_records"("roll_no", "late_date");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "late_records" ADD CONSTRAINT "late_records_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_records" ADD CONSTRAINT "late_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
