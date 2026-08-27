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

    console.log('3. Cargando extensiones...');

    await executeFile('000_extensions.sql');

    console.log('4. Cargando ENUMs...');

    await executeFile('organizations/001_enums.sql');
    await executeFile('user/001_enums.sql');
    await executeFile('elections/001_enums.sql');
    await executeFile('ballots/001_enums.sql');
    await executeFile('audit/001_enums.sql');

    console.log('5. Cargando funciones base...');

    await executeFile('005_base_functions.sql');

    console.log('6. Creando organizaciones...');

    await executeFile('organizations/002_organizations.sql');

    console.log('7. Creando usuarios...');

    await executeFile('user/002_users_table.sql');
    await executeFile('user/003_users_indexes.sql');
    await executeFile('user/004_users_triggers.sql');

    console.log('8. Creando tablas académicas...');

    await executeFile('academic/001_faculties.sql');
    await executeFile('academic/002_programs.sql');
    await executeFile('academic/003_academic_periods.sql');
    await executeFile('academic/004_voter_registries.sql');

    console.log('9. Creando solicitudes de organizaciones...');

    await executeFile('organizations/003_organization_requests.sql');

    console.log('10. Creando elecciones...');

    await executeFile('elections/002_elections.sql');
    await executeFile('elections/003_positions.sql');
    await executeFile('elections/004_candidate_lists.sql');
    await executeFile('elections/005_candidacies.sql');
    await executeFile('elections/006_election_rules.sql');

    console.log('11. Creando ballots...');

    await executeFile('ballots/002_ballots.sql');
    await executeFile('ballots/003_ballot_positions.sql');
    await executeFile('ballots/004_ballot_options.sql');

    console.log('12. Creando auditoría...');

    await executeFile('audit/002_audit_logs.sql');
    await executeFile('audit/003_audit_protection.sql');
    await executeFile('audit/004_one_time_tokens.sql');

    console.log('13. Creando resultados...');

    await executeFile('results/001_tallies.sql');
    await executeFile('results/002_election_results.sql');

    console.log('14. Creando votación...');

    await executeFile('voting/001_voting_sessions.sql');
    await executeFile('voting/002_votes.sql');
    await executeFile('voting/003_vote_selections.sql');

    console.log('15. Cargando funciones y vistas...');

    await executeFile('academic/005_voter_validation.sql');
    await executeFile('academic/006_views.sql');
    await executeFile('academic/007_functions.sql');

    await executeFile('ballots/005_views.sql');
    await executeFile('ballots/006_functions.sql');

    await executeFile('organizations/004_approval_functions.sql');

    await executeFile('results/003_turnout_trigger.sql');
    await executeFile('results/004_certify_election.sql');

    await executeFile('voting/004_start_session.sql');
    await executeFile('voting/005_cast_vote.sql');

    console.log('16. Cargando funciones de autenticación...');

    await executeFile('user/005_password_reset.sql');
    await executeFile('user/006_email_verification.sql');
    await executeFile('user/007_login_security.sql');
    await executeFile('user/008_cleanup_tokens.sql');

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