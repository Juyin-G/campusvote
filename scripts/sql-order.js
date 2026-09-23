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
 *
 * FASE 13: el dominio ELECTIONS (elections/ballots/voting/results/objections/
 * reports/public y los tokens de votación audit/004-005) fue eliminado del
 * backend, así que sus migraciones ya no se aplican.
 */

export const SQL_ORDER = [
  '000_extensions.sql',
  'user/000_roles.sql',
  '005_base_functions.sql',
  'organizations/001_enums.sql',
  'user/001_enums.sql',
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
  'user/010_media_files.sql',
  'user/011_document_identity.sql',
  'user/012_activation_enum.sql',
  'user/013_activation.sql',
  'user/014_remove_external_auth.sql',
  'user/015_activation_constraint.sql',
  'user/016_fix_cleanup_tokens.sql',
  'organizations/003_organization_requests.sql',
  'organizations/005_organization_member_limit.sql',
  'organizations/005_category_catalog.sql',
  'organizations/006_admin_requires_organization.sql',
  'organizations/007_admin_invite.sql',
  'organizations/018_regions.sql',
  'organizations/008_deferred_admin_activation.sql',
  'academic/000_prerequisites.sql',
  'academic/001_faculties.sql',
  'academic/002_programs.sql',
  'academic/009_careers.sql',
  'academic/003_academic_periods.sql',
  'academic/004_voter_registries.sql',
  'academic/010_voter_stake.sql',
  'academic/011_teaching_evaluations.sql',
  'academic/012_evaluation_domain.sql',
  'academic/013_evaluation_response_status.sql',
  'audit/002_audit_logs.sql',
  'audit/003_audit_protection.sql',
  'audit/006_audit_permissions.sql',
  'audit/007_actions_peru.sql',
  'audit/008_audit_action_add_milestone.sql',
  'audit/009_fix_audit_chain.sql',
  'organizations/020_fix_org_requests_reviewed_by_fk.sql',
  'academic/005_voter_validation.sql',
  'academic/006_views.sql',
  'academic/007_functions.sql',
  'academic/008_sis_sync.sql',
  'organizations/004_approval_functions.sql',
  'organizations/006_organization_sites.sql',
  'organizations/019_site_region.sql',
  'user/020a_user_scope_enum.sql',
  'user/020b_user_scope_columns.sql',
  'organizations/009_admin_scope_in_activation.sql',
  'user/021_user_site_assignments.sql',
  'user/022_drop_orphan_roles.sql',
  'user/023_teacher_faculty_optional.sql',
  'claims/001_voter_registry_claims.sql',
  'notifications/001_notifications.sql',
  'notifications/002_channels.sql',
  'i18n/001_locales_and_translations.sql',
  'projects/001_projects.sql',
  'fairs/001_fairs.sql',
  'projects/002_projects_fair.sql',
  'fairs/002_jury_assignments.sql',
  'fairs/003_fair_rubrics.sql',
  'fairs/004_fair_evaluations.sql',
  'fairs/005_fair_result_publications.sql',
  'fairs/006_fair_site.sql',
  'fairs/007_fair_categories.sql',
  'fairs/008_fair_stands.sql',
  'projects/003_projects_category_stand.sql',
  'fairs/009_fair_jury_declarations.sql',
  'fairs/010_jury_assignment_integrity.sql',
  'fairs/011_certificates.sql',
  'fairs/011_fair_registration_deadline.sql',
  'fairs/012a_fair_rubric_to_checklist.sql',
  'fairs/012b_fair_anonymous_voting.sql',
  'fairs/013_fair_engagement.sql',
  'fairs/014_fair_status_transition.sql',
  'fairs/015_fair_project_fk_repair.sql',
  'fairs/016_fair_jury_category_assignments.sql',
  'fairs/016_external_jury_invites.sql',
  'fairs/017_jury_category_integrity.sql',
  'fairs/018_fair_open_validation.sql',
  'academic/014_academic_periods_organization.sql',
  'fairs/019_fair_public_registration.sql',
  '999_foreign_keys.sql',
];

export default SQL_ORDER;
