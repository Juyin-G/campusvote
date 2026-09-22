-- ============================================================================
-- FASE 13 — ELIMINACIÓN ESTRUCTURAL DEL DOMINIO ELECTIONS
-- database/sql/_destructive/13_remove_elections.sql
--
-- EJECUTAR SOLO UNA VEZ contra una base EXISTENTE, DESPUÉS de desplegar el
-- código (módulos eliminados). Orden de borrado: hijas primero (FK).
--
-- NO se ejecuta automáticamente: no está en apply-sql.js ni setup-db.js.
-- Comando (seleccionar entorno):
--   psql "$DATABASE_URL" -f database/sql/_destructive/13_remove_elections.sql
--   MIGRATION_DATABASE_URL=... node -e "require('fs').readFile('database/sql/_destructive/13_remove_elections.sql','utf8',(e,s)=>{if(e)throw e;require('pg').Client(c=>{});c.connectionString=process.env.MIGRATION_DATABASE_URL;c.query(s).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})})"
--
-- ADVERTENCIA: DESTRUYE DATOS. Hacer BACKUP antes.
-- ============================================================================

BEGIN;

-- 1) TABLAS (hijas → padres; cada DROP usa CASCADE por seguridad).
--    17 tablas electorales + 3 huérfanas del dominio electoral encontradas
--    en bases existentes (ratings, rating_details, feria_criteria).
DROP TABLE IF EXISTS vote_selections             CASCADE;
DROP TABLE IF EXISTS votes                       CASCADE;
DROP TABLE IF EXISTS voting_sessions             CASCADE;
DROP TABLE IF EXISTS election_results            CASCADE;
DROP TABLE IF EXISTS tallies                     CASCADE;
DROP TABLE IF EXISTS ballot_options              CASCADE;
DROP TABLE IF EXISTS ballot_positions            CASCADE;
DROP TABLE IF EXISTS ballots                     CASCADE;
DROP TABLE IF EXISTS candidacy_documents         CASCADE;
DROP TABLE IF EXISTS candidacies                 CASCADE;
DROP TABLE IF EXISTS candidate_lists             CASCADE;
DROP TABLE IF EXISTS positions                   CASCADE;
DROP TABLE IF EXISTS election_rules              CASCADE;
DROP TABLE IF EXISTS candidacy_objections        CASCADE;
DROP TABLE IF EXISTS jury_assignments            CASCADE;
DROP TABLE IF EXISTS voting_access_tokens        CASCADE;
DROP TABLE IF EXISTS election_report_history     CASCADE;
DROP TABLE IF EXISTS rating_details              CASCADE;
DROP TABLE IF EXISTS ratings                     CASCADE;
DROP TABLE IF EXISTS feria_criteria              CASCADE;
DROP TABLE IF EXISTS elections                   CASCADE;

-- 2) COLUMNA election_id en audit_logs (FK → elections; JOIN de tenant).
ALTER TABLE audit_logs DROP COLUMN IF EXISTS election_id CASCADE;

-- 3) AUDIT: constraints de anonimato del voto electoral (CAST_VOTE), ya
--    inoperantes porque la acción fue removida del enum.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_anonymity;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_metadata_no_identity;

-- 4) FUNCIONES/VISTAS del dominio electoral (best-effort, IF EXISTS).
DROP FUNCTION IF EXISTS consume_voting_access_token(VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS validate_election_status_transition() CASCADE;
DROP FUNCTION IF EXISTS handle_election_completion() CASCADE;
DROP FUNCTION IF EXISTS update_vote_turnout() CASCADE;
DROP FUNCTION IF EXISTS tally_votes(UUID) CASCADE;
DROP FUNCTION IF EXISTS certify_election(UUID) CASCADE;
DROP FUNCTION IF EXISTS start_voting_session(UUID, UUID, INET, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS log_voting_activity(UUID, UUID, UUID, INET, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS cast_electoral_vote(UUID) CASCADE;
DROP FUNCTION IF EXISTS invalidate_voting_session(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_voter_stats_election(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_election_report_history(UUID) CASCADE;

DROP FUNCTION IF EXISTS can_user_vote(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS cast_secure_vote_with_session(UUID, UUID, TEXT, VARCHAR, JSONB, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS certify_weighted_election(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, quorum_fail_policy) CASCADE;
DROP FUNCTION IF EXISTS create_ballot_version(UUID) CASCADE;
DROP FUNCTION IF EXISTS enforce_ballot_immutability() CASCADE;
DROP FUNCTION IF EXISTS enforce_election_immutability() CASCADE;
DROP FUNCTION IF EXISTS enforce_elections_core_lock() CASCADE;
DROP FUNCTION IF EXISTS get_active_ballot(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_election_tally(UUID) CASCADE;
DROP FUNCTION IF EXISTS prevent_election_deletion() CASCADE;
DROP FUNCTION IF EXISTS register_election_report_generation(UUID, UUID, TEXT, CHAR, TEXT, VARCHAR, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS tally_election_votes(UUID) CASCADE;
DROP FUNCTION IF EXISTS validate_ballot_completeness(UUID) CASCADE;
DROP FUNCTION IF EXISTS validate_vote_integrity() CASCADE;
DROP FUNCTION IF EXISTS validate_vote_selection_election_match() CASCADE;
DROP FUNCTION IF EXISTS verify_election_integrity(UUID) CASCADE;
DROP FUNCTION IF EXISTS verify_vote_integrity(UUID) CASCADE;

DROP VIEW IF EXISTS v_active_ballots CASCADE;
DROP VIEW IF EXISTS v_ballot_full CASCADE;
DROP VIEW IF EXISTS v_ballot_position_candidates CASCADE;
DROP VIEW IF EXISTS v_position_candidates CASCADE;
DROP VIEW IF EXISTS v_public_candidates CASCADE;
DROP VIEW IF EXISTS v_election_participation CASCADE;
DROP VIEW IF EXISTS v_public_election_details CASCADE;
DROP VIEW IF EXISTS v_public_election_landing CASCADE;

-- 5) Migraciones registradas de dominios eliminados (solo limpieza del
--    registro; opcional).
DELETE FROM campusvote_schema_migrations
 WHERE filename IN (
    'elections/001_enums.sql',
    'elections/002_elections.sql',
    'elections/003_organization_scope.sql',
    'elections/003_positions.sql',
    'elections/004_candidate_lists.sql',
    'elections/005_candidacies.sql',
    'elections/006_election_rules.sql',
    'elections/007_candidacy_documents.sql',
    'elections/008_candidate_lists_fair_profile.sql',
    'elections/009_election_rules_peru.sql',
    'elections/010_candidacy_advisor.sql',
    'ballots/001_enums.sql',
    'ballots/002_ballots.sql',
    'ballots/003_ballot_positions.sql',
    'ballots/004_ballot_options.sql',
    'ballots/005_views.sql',
    'ballots/006_functions.sql',
    'audit/004_voting_access_tokens.sql',
    'audit/005_token_consumption.sql',
    'results/001_tallies.sql',
    'results/002_election_results.sql',
    'results/003_turnout_trigger.sql',
    'results/004_tally_votes.sql',
    'results/005_certify_election.sql',
    'results/006_weighted_fair.sql',
    'voting/001_voting_sessions.sql',
    'voting/002_votes.sql',
    'voting/003_vote_selections.sql',
    'voting/004_start_session.sql',
    'voting/005_cast_vote.sql',
    'voting/006_session_management.sql',
    'voting/007_vote_integrity.sql',
    'voting/008_scrutiny.sql',
    'reports/001_election_report_history.sql',
    'objections/001_candidacy_objections.sql',
    'public/001_public_election_landing.sql'
 );

-- 6) ENUMS residuos (no se pueden DROP VALUE). Opcional: regenerar el tipo.
--    audit_action_type conserva valores electorales inertes (CREATE_ELECTION,
--    CAST_VOTE, REGENERATE_BALLOT, etc.). Para purgarlos se debe recrear el
--    tipo y castear (acción manual, ver FASE 13.11 del reporte). Igual para
--    notification_type (ELECTION_OPENING, VOTE_CONFIRMATION, RESULTS_PUBLISHED,
--    CANDIDACY_APPROVED) y election_process_type/electoral enums si los hubiera.

COMMIT;