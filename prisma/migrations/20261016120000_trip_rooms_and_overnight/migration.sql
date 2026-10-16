-- AlterTable
ALTER TABLE "trip_participants" ADD COLUMN     "room_id" INTEGER;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "overnight" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "trip_rooms" (
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "beds" INTEGER NOT NULL,
    "place" VARCHAR(100),
    "notes" VARCHAR(200),

    CONSTRAINT "trip_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_rooms_trip_id_idx" ON "trip_rooms"("trip_id");

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "trip_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_rooms" ADD CONSTRAINT "trip_rooms_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

