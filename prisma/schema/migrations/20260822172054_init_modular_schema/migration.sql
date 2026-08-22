-- Create the citext extension if it doesn't exist

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- CreateEnum
CREATE TYPE "audit_action_type" AS ENUM ('LOGIN', 'VERIFY_2FA', 'CREATE_ELECTION', 'OPEN_ELECTION', 'CAST_VOTE', 'CLOSE_ELECTION', 'CERTIFY_RESULT', 'PUBLISH_RESULT');

-- CreateEnum
CREATE TYPE "election_process_type" AS ENUM ('VOTE', 'FAIR', 'FEEDBACK', 'FORM');

-- CreateEnum
CREATE TYPE "election_scope_type" AS ENUM ('UNIVERSITY', 'FACULTY', 'PROGRAM');

-- CreateEnum
CREATE TYPE "election_status_type" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CERTIFIED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ballot_option_type" AS ENUM ('CANDIDATE_LIST', 'BLANK', 'NULL');

-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'COMPANY', 'ASSOCIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "organization_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'ELECTORAL_COMMISSION', 'OBSERVER');

-- CreateEnum
CREATE TYPE "auth_provider_type" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "election_id" UUID,
    "action" "audit_action_type" NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "previous_hash" VARCHAR(64) NOT NULL DEFAULT '',
    "current_hash" VARCHAR(64) NOT NULL DEFAULT '',
    "signature" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "process_type" "election_process_type" NOT NULL DEFAULT 'VOTE',
    "election_type" "election_scope_type" NOT NULL,
    "period_id" UUID NOT NULL,
    "faculty_id" UUID,
    "program_id" UUID,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "election_status_type" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "form_structure" JSONB,
    "is_anonymous_allowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "min_turnout_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "allow_blank_vote" BOOLEAN NOT NULL DEFAULT true,
    "allow_null_vote" BOOLEAN NOT NULL DEFAULT true,
    "max_positions_per_ballot" SMALLINT NOT NULL DEFAULT 1,
    "requires_2fa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "total_voters" INTEGER NOT NULL DEFAULT 0,
    "total_votes_cast" INTEGER NOT NULL DEFAULT 0,
    "turnout_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "blank_votes" INTEGER NOT NULL DEFAULT 0,
    "null_votes" INTEGER NOT NULL DEFAULT 0,
    "certified_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "report_pdf" VARCHAR(500),
    "report_hash" VARCHAR(64),
    "report_signature" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "seats" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "acronym" VARCHAR(20),
    "motto" VARCHAR(255),
    "logo" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidacies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "candidate_list_id" UUID NOT NULL,
    "position_id" UUID,
    "user_id" UUID NOT NULL,
    "order_index" SMALLINT NOT NULL DEFAULT 1,
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballot_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ballot_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "order_index" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballot_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballot_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ballot_position_id" UUID NOT NULL,
    "option_type" "ballot_option_type" NOT NULL DEFAULT 'CANDIDATE_LIST',
    "candidate_list_id" UUID,
    "label" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballot_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "org_type" "organization_type" NOT NULL DEFAULT 'UNIVERSITY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logo" VARCHAR(500),
    "primary_color" VARCHAR(7) NOT NULL DEFAULT '#0066CC',
    "secondary_color" VARCHAR(7) NOT NULL DEFAULT '#FFD700',
    "country" VARCHAR(100) NOT NULL DEFAULT 'Perú',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Lima',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institution_name" VARCHAR(200) NOT NULL,
    "institution_type" "organization_type" NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "estimated_members" INTEGER NOT NULL,
    "contact_email" CITEXT NOT NULL,
    "contact_phone" VARCHAR(20),
    "message" TEXT,
    "status" "organization_request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "faculty_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "password" VARCHAR(255),
    "auth_provider" "auth_provider_type" NOT NULL DEFAULT 'LOCAL',
    "google_id" VARCHAR(255),
    "last_login" TIMESTAMPTZ(6),
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "username" CITEXT NOT NULL,
    "first_name" VARCHAR(150) NOT NULL DEFAULT '',
    "last_name" VARCHAR(150) NOT NULL DEFAULT '',
    "email" CITEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_joined" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutional_id" CITEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'STUDENT',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" UUID,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" VARCHAR(255),
    "two_factor_backup_codes" JSONB NOT NULL DEFAULT '[]',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_registries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "semester" SMALLINT NOT NULL,
    "is_eligible" BOOLEAN NOT NULL DEFAULT true,
    "eligibility_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voter_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voting_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "voter_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,
    "is_successful" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "voter_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "cast_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_code" VARCHAR(64) NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "payload_hash" VARCHAR(128) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_selections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vote_id" UUID NOT NULL,
    "ballot_option_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tallies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "election_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "votes_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tallies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_action_timestamp" ON "audit_logs"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_election_timestamp" ON "audit_logs"("election_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_timestamp_desc" ON "audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_elections_created_by" ON "elections"("created_by");

-- CreateIndex
CREATE INDEX "idx_elections_period" ON "elections"("period_id");

-- CreateIndex
CREATE INDEX "idx_elections_status" ON "elections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "election_rules_election_id_key" ON "election_rules"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "election_results_election_id_key" ON "election_results"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_positions_election_name" ON "positions"("election_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_candidate_lists_election_name" ON "candidate_lists"("election_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_candidate_lists_id_election" ON "candidate_lists"("id", "election_id");

-- CreateIndex
CREATE INDEX "idx_candidacies_candidate_list_id" ON "candidacies"("candidate_list_id");

-- CreateIndex
CREATE INDEX "idx_candidacies_user_id" ON "candidacies"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_candidacies_election_user" ON "candidacies"("election_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_candidacies_position_user" ON "candidacies"("position_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_ballots_election_id" ON "ballots"("election_id");

-- CreateIndex
CREATE INDEX "idx_ballots_generated_at" ON "ballots"("generated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_ballots_election_version" ON "ballots"("election_id", "version");

-- CreateIndex
CREATE INDEX "idx_ballot_positions_position_id" ON "ballot_positions"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ballot_positions_ballot_order" ON "ballot_positions"("ballot_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ballot_positions_ballot_position" ON "ballot_positions"("ballot_id", "position_id");

-- CreateIndex
CREATE INDEX "idx_ballot_options_candidate_list_id" ON "ballot_options"("candidate_list_id");

-- CreateIndex
CREATE INDEX "idx_ballot_options_type" ON "ballot_options"("option_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ballot_options_position_candidate" ON "ballot_options"("ballot_position_id", "candidate_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "idx_org_requests_email" ON "organization_requests"("contact_email");

-- CreateIndex
CREATE INDEX "idx_org_requests_status" ON "organization_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculties_name" ON "faculties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculties_code" ON "faculties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_programs_code" ON "programs"("code");

-- CreateIndex
CREATE INDEX "idx_programs_faculty_id" ON "programs"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_programs_faculty_name" ON "programs"("faculty_id", "name");

-- CreateIndex
CREATE INDEX "idx_academic_periods_dates" ON "academic_periods"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_google_id" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_institutional_id" ON "users"("institutional_id");

-- CreateIndex
CREATE INDEX "idx_users_date_joined_desc" ON "users"("date_joined" DESC);

-- CreateIndex
CREATE INDEX "idx_users_organization_id" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_verification_tokens_token_hash" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_email_verification_tokens_user" ON "email_verification_tokens"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_voter_registries_period_id" ON "voter_registries"("period_id");

-- CreateIndex
CREATE INDEX "idx_voter_registries_program_id" ON "voter_registries"("program_id");

-- CreateIndex
CREATE INDEX "idx_voter_registries_program_period" ON "voter_registries"("program_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_voter_registries_user_period" ON "voter_registries"("user_id", "period_id");

-- CreateIndex
CREATE INDEX "idx_voting_sessions_election" ON "voting_sessions"("election_id");

-- CreateIndex
CREATE INDEX "idx_voting_sessions_voter" ON "voting_sessions"("voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_session_id_key" ON "votes"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_receipt_code_key" ON "votes"("receipt_code");

-- CreateIndex
CREATE INDEX "idx_votes_cast_at" ON "votes"("cast_at" DESC);

-- CreateIndex
CREATE INDEX "idx_votes_election" ON "votes"("election_id");

-- CreateIndex
CREATE INDEX "idx_votes_payload_hash" ON "votes"("payload_hash");

-- CreateIndex
CREATE INDEX "idx_votes_voter" ON "votes"("voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_votes_election_voter" ON "votes"("election_id", "voter_id");

-- CreateIndex
CREATE INDEX "idx_vote_selections_ballot_option" ON "vote_selections"("ballot_option_id");

-- CreateIndex
CREATE INDEX "idx_vote_selections_vote" ON "vote_selections"("vote_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_vote_selections_vote_option" ON "vote_selections"("vote_id", "ballot_option_id");

-- CreateIndex
CREATE INDEX "idx_tallies_position" ON "tallies"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tallies_election_position_option" ON "tallies"("election_id", "position_id", "option_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_token_hash_key" ON "one_time_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_ott_election" ON "one_time_tokens"("election_id");

-- CreateIndex
CREATE INDEX "idx_ott_user_election" ON "one_time_tokens"("user_id", "election_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "election_rules" ADD CONSTRAINT "election_rules_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "election_results" ADD CONSTRAINT "election_results_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidate_lists" ADD CONSTRAINT "candidate_lists_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "fk_candidacies_candidate_list_election" FOREIGN KEY ("candidate_list_id", "election_id") REFERENCES "candidate_lists"("id", "election_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ballot_positions" ADD CONSTRAINT "ballot_positions_ballot_id_fkey" FOREIGN KEY ("ballot_id") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ballot_positions" ADD CONSTRAINT "ballot_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ballot_options" ADD CONSTRAINT "ballot_options_ballot_position_id_fkey" FOREIGN KEY ("ballot_position_id") REFERENCES "ballot_positions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ballot_options" ADD CONSTRAINT "ballot_options_candidate_list_id_fkey" FOREIGN KEY ("candidate_list_id") REFERENCES "candidate_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "voter_registries" ADD CONSTRAINT "voter_registries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "voter_registries" ADD CONSTRAINT "voter_registries_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "voter_registries" ADD CONSTRAINT "voter_registries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "voting_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vote_selections" ADD CONSTRAINT "vote_selections_ballot_option_id_fkey" FOREIGN KEY ("ballot_option_id") REFERENCES "ballot_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vote_selections" ADD CONSTRAINT "vote_selections_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tallies" ADD CONSTRAINT "tallies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tallies" ADD CONSTRAINT "tallies_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "ballot_options"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tallies" ADD CONSTRAINT "tallies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
