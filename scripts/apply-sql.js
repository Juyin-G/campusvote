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
// FASE 13: el dominio ELECTIONS fue eliminado, por lo que las migraciones
// de elections/ballots/voting/results/objections/reports/public y los tokens
// de votación (audit/004,005) fueron removidas de esta lista.
const MIGRATION_FILES =[
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
  'organizations/019_site_region.sql',          // <--- MIGRACIÓN AGREGADA
  'user/020a_user_scope_enum.sql',               // <--- MIGRACIÓN AGREGADA (Crea scope_level)
  'user/020b_user_scope_columns.sql',            // <--- MIGRACIÓN AGREGADA (Agrega scope_level a users)
  'organizations/009_admin_scope_in_activation.sql',
  'user/021_user_site_assignments.sql',          // <--- MIGRACIÓN AGREGADA
  'user/022_drop_orphan_roles.sql',              // <--- Limpia OBSERVER y ELECTORAL_COMMISSION del enum
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
  'fairs/012a_fair_rubric_to_checklist.sql',
  'fairs/012b_fair_anonymous_voting.sql',
  'fairs/013_fair_engagement.sql',
  'fairs/014_fair_status_transition.sql',        // <--- Parte 3: máquina de estados de feria
  'fairs/015_fair_project_fk_repair.sql', 
  'fairs/016_fair_jury_category_assignments.sql', 
  'fairs/017_jury_category_integrity.sql',        
  'fairs/018_fair_open_validation.sql',     
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
