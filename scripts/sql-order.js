/**
 * @file sql-order.js
 * @description Orden canónico de los scripts SQL de database/sql/.
 *
 * Fuente única de verdad: la usan tanto el arranque de los tests
 * (tests/setup-db.js) como el aplicador de producción (scripts/apply-sql.js).
 * Tenerlo duplicado ya provocó que ambos se desincronizaran y que las
 * funciones de seguridad del login no se cargaran en instalaciones limpias.
 *
 * El orden importa: extensiones y enums primero, después tablas respetando
 * sus dependencias, luego funciones y vistas, y al final las claves foráneas
 * que cruzan módulos.
 */

export const SQL_ORDER = [
  '000_extensions.sql',
  'user/000_roles.sql',
  '005_base_functions.sql',
  'organizations/001_enums.sql',
  'user/001_enums.sql',
  'elections/001_enums.sql',
  'ballots/001_enums.sql',
  'audit/001_enums.sql',
  'organizations/002_organizations.sql',
  'user/002_users_table.sql',
  'user/003_users_indexes.sql',
  'user/004_users_triggers.sql',
  'user/005_refresh_tokens.sql',
  'user/006_password_reset.sql',
  'user/007_email_verification.sql',
  'user/008_login_security.sql',
  'user/009_cleanup_tokens.sql',
  'organizations/003_organization_requests.sql',
  'academic/001_faculties.sql',
  'academic/002_programs.sql',
  'academic/003_academic_periods.sql',
  'academic/004_voter_registries.sql',
  'elections/002_elections.sql',
  'elections/003_positions.sql',
  'elections/004_candidate_lists.sql',
  'elections/005_candidacies.sql',
  'elections/006_election_rules.sql',
  'elections/007_candidacy_documents.sql',
  'ballots/002_ballots.sql',
  'ballots/003_ballot_positions.sql',
  'ballots/004_ballot_options.sql',
  'audit/002_audit_logs.sql',
  'audit/003_audit_protection.sql',
  'audit/004_voting_access_tokens.sql',
  'audit/005_token_consumption.sql',
  'audit/006_audit_permissions.sql',
  'results/001_tallies.sql',
  'results/002_election_results.sql',
  'voting/001_voting_sessions.sql',
  'voting/002_votes.sql',
  'voting/003_vote_selections.sql',
  'academic/005_voter_validation.sql',
  'academic/006_views.sql',
  'academic/007_functions.sql',
  'academic/008_sis_sync.sql',
  'ballots/005_views.sql',
  'ballots/006_functions.sql',
  'organizations/004_approval_functions.sql',
  'results/003_turnout_trigger.sql',
  'results/004_tally_votes.sql',
  'results/005_certify_election.sql',
  'voting/004_start_session.sql',
  'voting/005_cast_vote.sql',
  'voting/006_session_management.sql',
  'voting/007_vote_integrity.sql',
  'voting/008_scrutiny.sql',
  'notifications/001_notifications.sql',
  'i18n/001_locales_and_translations.sql',
  '999_foreign_keys.sql',
];

export default SQL_ORDER;
