-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('STUDY_TOUR', 'INDUSTRIAL_VISIT', 'SPORTS', 'COMPETITION', 'RECREATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('OPEN', 'CLOSED', 'DEPARTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'RECEIVED', 'REFUSED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('REGISTERED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "trips" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "type" "TripType" NOT NULL DEFAULT 'STUDY_TOUR',
    "destination" VARCHAR(150) NOT NULL,
    "purpose" TEXT,
    "itinerary" TEXT,
    "depart_date" DATE NOT NULL,
    "depart_time" VARCHAR(5) NOT NULL,
    "return_date" DATE NOT NULL,
    "return_time" VARCHAR(5) NOT NULL,
    "meeting_point" VARCHAR(150),
    "programs" TEXT[],
    "seats" INTEGER,
    "fee_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fee_deadline" DATE,
    "consent_deadline" DATE,
    "in_charge_name" VARCHAR(100) NOT NULL,
    "in_charge_phone" VARCHAR(20),
    "status" "TripStatus" NOT NULL DEFAULT 'OPEN',
    "departed_at" TIMESTAMPTZ(3),
    "departure_note" VARCHAR(300),
    "returned_at" TIMESTAMPTZ(3),
    "return_note" VARCHAR(300),
    "cancel_reason" VARCHAR(300),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_staff" (
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "role" VARCHAR(40) NOT NULL,

    CONSTRAINT "trip_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_vehicles" (
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "driver_name" VARCHAR(100),
    "driver_phone" VARCHAR(20),
    "seats" INTEGER,

    CONSTRAINT "trip_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_participants" (
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "roll_no" VARCHAR(20) NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'REGISTERED',
    "consent" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consent_at" DATE,
    "fee_paid" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fee_paid_at" DATE,
    "receipt_no" VARCHAR(30),
    "medical_notes" VARCHAR(300),
    "emergency_phone" VARCHAR(20),
    "vehicle_id" INTEGER,
    "departed_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "override_note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trips_depart_date_idx" ON "trips"("depart_date");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trip_staff_trip_id_idx" ON "trip_staff"("trip_id");

-- CreateIndex
CREATE INDEX "trip_vehicles_trip_id_idx" ON "trip_vehicles"("trip_id");

-- CreateIndex
CREATE INDEX "trip_participants_roll_no_idx" ON "trip_participants"("roll_no");

-- CreateIndex
CREATE UNIQUE INDEX "trip_participants_trip_id_roll_no_key" ON "trip_participants"("trip_id", "roll_no");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_staff" ADD CONSTRAINT "trip_staff_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_vehicles" ADD CONSTRAINT "trip_vehicles_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "trip_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

