// scripts/apply-sql.js
// Aplica las migraciones SQL en el orden correcto sobre la base de datos
// indicada por MIGRATION_DATABASE_URL (o DATABASE_URL como fallback).
// Diseñado para ejecutarse de forma segura en producción (Render/Heroku y
// similares), donde no hay Docker ni scripts PowerShell.
//
// Uso:
//   node scripts/apply-sql.js            # usa MIGRATION_DATABASE_URL o DATABASE_URL
//   MIGRATION_DATABASE_URL=... node scripts/apply-sql.js

import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Orden de ejecución canónico (idéntico a tests/setup-db.js).
const MIGRATION_FILES = [
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
  'user/010_media_files.sql',
  'user/011_document_identity.sql',
  'user/012_activation_enum.sql',
  'user/013_activation.sql',
  'user/014_remove_external_auth.sql',
  'user/015_activation_constraint.sql',
  'organizations/003_organization_requests.sql',
  'organizations/005_organization_member_limit.sql',
  'organizations/005_category_catalog.sql',
  'organizations/006_admin_requires_organization.sql',
  'organizations/007_admin_invite.sql',
  'organizations/008_deferred_admin_activation.sql',
  'academic/000_prerequisites.sql',
  'academic/001_faculties.sql',
  'academic/002_programs.sql',
  'academic/009_careers.sql',
  'academic/003_academic_periods.sql',
  'academic/004_voter_registries.sql',
  'academic/010_voter_stake.sql',
  'academic/011_teaching_evaluations.sql',
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
  'ballots/002_ballots.sql',
  'ballots/003_ballot_positions.sql',
  'ballots/004_ballot_options.sql',
  'audit/002_audit_logs.sql',
  'audit/003_audit_protection.sql',
  'audit/004_voting_access_tokens.sql',
  'audit/005_token_consumption.sql',
  'audit/006_audit_permissions.sql',
  'audit/007_actions_peru.sql',
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
  'organizations/006_organization_sites.sql',
  'reports/001_election_report_history.sql',
  'claims/001_voter_registry_claims.sql',
  'objections/001_candidacy_objections.sql',
  'public/001_public_election_landing.sql',
  'results/003_turnout_trigger.sql',
  'results/004_tally_votes.sql',
  'results/005_certify_election.sql',
  'results/006_weighted_fair.sql',
  'voting/004_start_session.sql',
  'voting/005_cast_vote.sql',
  'voting/006_session_management.sql',
  'voting/007_vote_integrity.sql',
  'voting/008_scrutiny.sql',
  'ratings/001_ratings.sql',
  'ratings/002_feria_rubrics.sql',
  'ratings/003_jury_assignments.sql',
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
  '999_foreign_keys.sql',
];

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('FATAL: MIGRATION_DATABASE_URL o DATABASE_URL no está configurada.');
  process.exit(1);
}

const sqlRoot = path.resolve(__dirname, '../database/sql');

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  try {
    console.log('Conectando a la base de datos...');
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS campusvote_schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Aplicando migraciones SQL:');
    for (const relativePath of MIGRATION_FILES) {
      const applied = await client.query(
        'SELECT 1 FROM campusvote_schema_migrations WHERE filename = $1',
        [relativePath]
      );
      if (applied.rowCount > 0) {
        process.stdout.write(`   → ${relativePath} omitida (ya aplicada)\n`);
        continue;
      }
      const filePath = path.join(sqlRoot, relativePath);
      const sql = await fs.readFile(filePath, 'utf8');
      process.stdout.write(`   → ${relativePath} `);
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO campusvote_schema_migrations (filename) VALUES ($1)',
          [relativePath]
        );
        process.stdout.write('OK\n');
      } catch (err) {
        // Si el script falló a mitad de un bloque BEGIN...COMMIT, la conexión
        // queda en una transacción abortada que rompería los siguientes
        // archivos. Forzamos ROLLBACK para limpiar el estado.
        await client.query('ROLLBACK').catch(() => {});
        // Archivos opcionales (módulos/extensiones que pueden no desplegarse)
        const optional =
          relativePath.includes('claims/') ||
          relativePath.includes('objections/') ||
          relativePath.includes('public/') ||
          relativePath.includes('reports/');
        if (optional) {
          process.stdout.write(`omito (${String(err.message).split('\n')[0]})\n`);
        } else {
          throw new Error(`${relativePath}:\n${err.message}`);
        }
      }
    } 

    console.log('');
    console.log('==========================================');
    console.log('Migraciones aplicadas correctamente.');
    console.log('==========================================');
  } catch (err) {
    console.error('');
    console.error('ERROR aplicando migraciones:');
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();