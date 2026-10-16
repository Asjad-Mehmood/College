-- ID card custody is no longer tracked. Records whose action was
-- "ID card confiscated" become written warnings before the enum value goes.
UPDATE "late_records" SET "action_taken" = 'WRITTEN_WARNING' WHERE "action_taken" = 'ID_CONFISCATED';

-- AlterEnum
BEGIN;
CREATE TYPE "DisciplineAction_new" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'FINE', 'PARENT_CALLED', 'DETENTION', 'PARENT_MEETING');
ALTER TABLE "public"."late_records" ALTER COLUMN "action_taken" DROP DEFAULT;
ALTER TABLE "late_records" ALTER COLUMN "action_taken" TYPE "DisciplineAction_new" USING ("action_taken"::text::"DisciplineAction_new");
ALTER TYPE "DisciplineAction" RENAME TO "DisciplineAction_old";
ALTER TYPE "DisciplineAction_new" RENAME TO "DisciplineAction";
DROP TYPE "public"."DisciplineAction_old";
ALTER TABLE "late_records" ALTER COLUMN "action_taken" SET DEFAULT 'VERBAL_WARNING';
COMMIT;

-- DropIndex
DROP INDEX "late_records_id_card_status_idx";

-- AlterTable
ALTER TABLE "late_records" DROP COLUMN "card_return_note",
DROP COLUMN "card_returned_at",
DROP COLUMN "id_card_status";

-- DropEnum
DROP TYPE "CardStatus";

