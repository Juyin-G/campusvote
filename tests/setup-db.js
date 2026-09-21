import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en .env.test');
}

export default async function setupTestDB() {
  const pgClient = new Client({
    connectionString: DATABASE_URL,
  });

  const sqlRoot = path.resolve(__dirname, '../database/sql');

  async function executeFile(relativePath) {
    const filePath = path.join(sqlRoot, relativePath);

    console.log(`   → ${relativePath}`);

    const sql = await fs.readFile(filePath, 'utf8');

    await pgClient.query(sql);
  }

  try {
    console.log('1. Conectando a PostgreSQL de pruebas...');
    await pgClient.connect();

    console.log('2. Limpiando esquema public...');

    await pgClient.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    console.log('3. Cargando extensiones y rol de la aplicación...');

    await executeFile('000_extensions.sql');
    await executeFile('user/000_roles.sql');

    console.log('4. Cargando ENUMs y funciones base...');

    await executeFile('005_base_functions.sql');
    await executeFile('organizations/001_enums.sql');
    await executeFile('user/001_enums.sql');
    await executeFile('elections/001_enums.sql');
    await executeFile('ballots/001_enums.sql');
    await executeFile('audit/001_enums.sql');

    console.log('5. Creando organizaciones...');

    await executeFile('organizations/002_organizations.sql');
    await executeFile('organizations/005_category_catalog.sql');
    await executeFile('organizations/005_organization_member_limit.sql');

    console.log('6. Creando usuarios y funciones de sesión/verificación...');

    await executeFile('user/002_users_table.sql');
    await executeFile('user/003_users_indexes.sql');
    await executeFile('user/004_users_triggers.sql');
    await executeFile('user/005_refresh_tokens.sql');
    await executeFile('user/006_password_reset.sql');
    await executeFile('user/007_email_verification.sql');
    await executeFile('user/008_login_security.sql');
    await executeFile('user/009_cleanup_tokens.sql');
    await executeFile('user/010_media_files.sql');
    await executeFile('user/011_document_identity.sql');
    await executeFile('user/012_activation_enum.sql');
    await executeFile('user/013_activation.sql');
    await executeFile('user/014_remove_external_auth.sql');
    await executeFile('user/015_activation_constraint.sql');

    await executeFile('organizations/006_admin_requires_organization.sql');
    await executeFile('organizations/007_admin_invite.sql');
    // CAMBIO: scope multi-sede (region/site) + eliminación de ELECTORAL_COMMISSION.
    // Estas migraciones se cargan AQUÍ solo para los pasos que no dependen
    // todavía de organization_sites. La carga completa (018_regions → 006_sites
    // → 019_site_region → 020_user_scope → 021_user_site_assignments) se
    // reaplica más abajo, después de 006_organization_sites.sql, para que la
    // FK users.region_id → regions y los índices tengan sentido.
    await executeFile('organizations/018_regions.sql');

    console.log('7. Creando solicitudes de organizaciones...');

    await executeFile('organizations/003_organization_requests.sql');
    await executeFile('organizations/008_deferred_admin_activation.sql');

    console.log('8. Creando tablas académicas...');

    await executeFile('academic/001_faculties.sql');
    await executeFile('academic/002_programs.sql');                 
    await executeFile('academic/009_careers.sql');                  
    await executeFile('academic/003_academic_periods.sql');
    await executeFile('academic/004_voter_registries.sql');
    await executeFile('academic/010_voter_stake.sql');
    await executeFile('academic/011_teaching_evaluations.sql');

    // Prisma expects the evaluation_response_status enum type, but 012
    // uses VARCHAR. Create the enum and alter the column before loading.
    await pgClient.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_response_status') THEN
        CREATE TYPE evaluation_response_status AS ENUM ('DRAFT', 'SUBMITTED');
      END IF;
    END$$;`);
    await executeFile('academic/012_evaluation_domain.sql');
    // After table creation, migrate status column from VARCHAR to enum
    await pgClient.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'evaluation_responses'
          AND column_name = 'status'
          AND data_type = 'character varying'
      ) THEN
        ALTER TABLE evaluation_responses
          ALTER COLUMN status DROP DEFAULT,
          ALTER COLUMN status TYPE evaluation_response_status USING status::evaluation_response_status,
          ALTER COLUMN status SET DEFAULT 'DRAFT';
      END IF;
    END$$;`);

    console.log('9. Creando elecciones...');

    await executeFile('elections/002_elections.sql');
    await executeFile('elections/003_organization_scope.sql');
    await executeFile('elections/003_positions.sql');
    await executeFile('elections/004_candidate_lists.sql');
    await executeFile('elections/005_candidacies.sql');
    await executeFile('elections/006_election_rules.sql');
    await executeFile('elections/007_candidacy_documents.sql');
    await executeFile('elections/008_candidate_lists_fair_profile.sql');
    await executeFile('elections/009_election_rules_peru.sql');
    await executeFile('elections/010_candidacy_advisor.sql');

    console.log('10. Creando ballots...');

    await executeFile('ballots/002_ballots.sql');
    await executeFile('ballots/003_ballot_positions.sql');
    await executeFile('ballots/004_ballot_options.sql');

    console.log('11. Creando auditoría...');

    await executeFile('audit/002_audit_logs.sql');
    await executeFile('audit/003_audit_protection.sql');
    await executeFile('audit/004_voting_access_tokens.sql');
    await executeFile('audit/005_token_consumption.sql');
    await executeFile('audit/006_audit_permissions.sql');
    await executeFile('audit/007_actions_peru.sql');

    console.log('12. Creando resultados...');

    await executeFile('results/001_tallies.sql');
    await executeFile('results/002_election_results.sql');

    console.log('13. Creando votación...');

    await executeFile('voting/001_voting_sessions.sql');
    await executeFile('voting/002_votes.sql');
    await executeFile('voting/003_vote_selections.sql');

    console.log('14. Cargando funciones y vistas...');

    await executeFile('academic/005_voter_validation.sql');
    await executeFile('academic/006_views.sql');
    await executeFile('academic/007_functions.sql');
    await executeFile('academic/008_sis_sync.sql');

    await executeFile('ballots/005_views.sql');
    await executeFile('ballots/006_functions.sql');

    await executeFile('organizations/004_approval_functions.sql');

    await executeFile('organizations/006_organization_sites.sql');

    // Re-ordenado: ahora que organization_sites existe, aplicamos el resto
    // del scope multi-sede (regiones + asignaciones SITE).
    await executeFile('organizations/019_site_region.sql');
    await executeFile('user/020a_user_scope_enum.sql');
    await executeFile('user/020b_user_scope_columns.sql');
    await executeFile('user/021_user_site_assignments.sql');

    await executeFile('reports/001_election_report_history.sql');
    await executeFile('claims/001_voter_registry_claims.sql');
    await executeFile('objections/001_candidacy_objections.sql');
    await executeFile('public/001_public_election_landing.sql');

    await executeFile('results/003_turnout_trigger.sql');
    await executeFile('results/004_tally_votes.sql');
    await executeFile('results/005_certify_election.sql');
    await executeFile('results/006_weighted_fair.sql');

    await executeFile('voting/004_start_session.sql');
    await executeFile('voting/005_cast_vote.sql');
    await executeFile('voting/006_session_management.sql');
    await executeFile('voting/007_vote_integrity.sql');
    await executeFile('voting/008_scrutiny.sql');
    await executeFile('ratings/001_ratings.sql');
    await executeFile('ratings/002_feria_rubrics.sql');
    await executeFile('ratings/003_jury_assignments.sql');

    console.log('15. Cargando notificaciones e i18n...');

    await executeFile('notifications/001_notifications.sql');
    await executeFile('notifications/002_channels.sql');
    await executeFile('i18n/001_locales_and_translations.sql');

    console.log('16. Creando proyectos y ferias académicas...');

    await executeFile('projects/001_projects.sql');
    await executeFile('fairs/001_fairs.sql');
    await executeFile('projects/002_projects_fair.sql');
    await executeFile('fairs/002_jury_assignments.sql');
    await executeFile('fairs/003_fair_rubrics.sql');
    await executeFile('fairs/004_fair_evaluations.sql');
    await executeFile('fairs/005_fair_result_publications.sql');
    await executeFile('fairs/006_fair_site.sql');
    await executeFile('fairs/007_fair_categories.sql');
    await executeFile('fairs/008_fair_stands.sql');
    await executeFile('projects/003_projects_category_stand.sql');
    await executeFile('fairs/009_fair_jury_declarations.sql');
    await executeFile('fairs/010_jury_assignment_integrity.sql');
    await executeFile('fairs/011_certificates.sql');
    await executeFile('fairs/012a_fair_rubric_to_checklist.sql');
    await executeFile('fairs/012b_fair_anonymous_voting.sql');
    await executeFile('fairs/013_fair_engagement.sql');
    await executeFile('fairs/014_fair_status_transition.sql');
    await executeFile('fairs/015_fair_project_fk_repair.sql');
    await executeFile('fairs/016_fair_jury_category_assignments.sql');
    await executeFile('fairs/017_jury_category_integrity.sql');
    await executeFile('fairs/018_fair_open_validation.sql');

    console.log('17. Cargando foreign keys finales...');

    await executeFile('999_foreign_keys.sql');

    console.log('');
    console.log('==========================================');
    console.log('Base de datos de pruebas lista');
    console.log('==========================================');
  } catch (error) {
    console.error('');
    console.error('ERROR configurando la base de datos de pruebas:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}