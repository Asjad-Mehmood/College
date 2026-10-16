-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('SELECTED', 'WAITLIST', 'DROPPED');

-- CreateEnum
CREATE TYPE "TrialResult" AS ENUM ('PENDING', 'SELECTED', 'WAITLIST', 'REJECTED');

-- CreateTable
CREATE TABLE "sports" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "coach" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "season" VARCHAR(20) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "coach" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "roll_no" VARCHAR(20) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'Player',
    "jersey_no" INTEGER,
    "position" VARCHAR(40),
    "status" "MemberStatus" NOT NULL DEFAULT 'SELECTED',
    "medical_note" VARCHAR(300),
    "consent" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "override_note" VARCHAR(200),
    "added_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trials" (
    "id" SERIAL NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "trial_date" DATE NOT NULL,
    "venue" VARCHAR(100),
    "notes" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_candidates" (
    "id" SERIAL NOT NULL,
    "trial_id" INTEGER NOT NULL,
    "roll_no" VARCHAR(20) NOT NULL,
    "result" "TrialResult" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(200),

    CONSTRAINT "trial_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
    "roll_no" VARCHAR(20),
    "team_id" INTEGER,
    "event" VARCHAR(120) NOT NULL,
    "position" VARCHAR(60) NOT NULL,
    "achieved_on" DATE NOT NULL,
    "notes" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_sport_id_season_category_key" ON "teams"("sport_id", "season", "category");

-- CreateIndex
CREATE INDEX "team_members_roll_no_idx" ON "team_members"("roll_no");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_roll_no_key" ON "team_members"("team_id", "roll_no");

-- CreateIndex
CREATE INDEX "trials_trial_date_idx" ON "trials"("trial_date");

-- CreateIndex
CREATE UNIQUE INDEX "trial_candidates_trial_id_roll_no_key" ON "trial_candidates"("trial_id", "roll_no");

-- CreateIndex
CREATE INDEX "achievements_roll_no_idx" ON "achievements"("roll_no");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trials" ADD CONSTRAINT "trials_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_candidates" ADD CONSTRAINT "trial_candidates_trial_id_fkey" FOREIGN KEY ("trial_id") REFERENCES "trials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_candidates" ADD CONSTRAINT "trial_candidates_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_roll_no_fkey" FOREIGN KEY ("roll_no") REFERENCES "students"("roll_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Starter sports; the Discipline In-Charge can add or deactivate more.
INSERT INTO "sports" ("name") VALUES
  ('Cricket'), ('Football'), ('Hockey'), ('Volleyball'), ('Basketball'),
  ('Badminton'), ('Table tennis'), ('Athletics'), ('Kabaddi'), ('Swimming');
