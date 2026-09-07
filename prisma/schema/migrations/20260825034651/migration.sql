/*
  Warnings:

  - You are about to drop the column `session_id` on the `votes` table. All the data in the column will be lost.
  - You are about to drop the column `voter_id` on the `votes` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "election_process_type" ADD VALUE 'EVENT_POLL';
ALTER TYPE "election_process_type" ADD VALUE 'AWARD';

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_session_id_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_voter_id_fkey";

-- DropIndex
DROP INDEX "idx_users_date_joined_desc";

-- DropIndex
DROP INDEX "idx_users_organization_id";

-- DropIndex
DROP INDEX "idx_users_role";

-- DropIndex
DROP INDEX "idx_votes_voter";

-- DropIndex
DROP INDEX "uq_votes_election_voter";

-- DropIndex
DROP INDEX "votes_session_id_key";

-- AlterTable
ALTER TABLE "candidacies" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "candidate_lists" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "course_section_id" UUID;

-- AlterTable
ALTER TABLE "tallies" ADD COLUMN     "average_score" DECIMAL(3,2),
ADD COLUMN     "total_score" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_biometric_verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" SET DATA TYPE TEXT,
ALTER COLUMN "google_id" SET DATA TYPE TEXT,
ALTER COLUMN "username" SET DATA TYPE TEXT,
ALTER COLUMN "first_name" SET DATA TYPE TEXT,
ALTER COLUMN "last_name" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "institutional_id" SET DATA TYPE TEXT,
ALTER COLUMN "two_factor_secret" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "vote_selections" ADD COLUMN     "score" SMALLINT,
ADD COLUMN     "text_feedback" TEXT;

-- AlterTable
ALTER TABLE "voter_registries" ADD COLUMN     "has_voted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "votes" DROP COLUMN "session_id",
DROP COLUMN "voter_id";

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "teacher_id" UUID,
    "section_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "device_os" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_courses_program_id" ON "courses"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_courses_program_code" ON "courses"("program_id", "code");

-- CreateIndex
CREATE INDEX "idx_course_sections_teacher_id" ON "course_sections"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sections_course_period_code" ON "course_sections"("course_id", "period_id", "section_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_fcm_token_key" ON "user_devices"("fcm_token");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_course_section_id_fkey" FOREIGN KEY ("course_section_id") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "uq_users_email" RENAME TO "users_email_key";

-- RenameIndex
ALTER INDEX "uq_users_google_id" RENAME TO "users_google_id_key";

-- RenameIndex
ALTER INDEX "uq_users_institutional_id" RENAME TO "users_institutional_id_key";

-- RenameIndex
ALTER INDEX "uq_users_username" RENAME TO "users_username_key";
