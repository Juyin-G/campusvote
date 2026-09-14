import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { SQL_ORDER } from '../scripts/sql-order.js';

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

    // Mismo orden que el aplicador de producción (scripts/apply-sql.js):
    // una sola lista evita que la base de pruebas quede distinta a la real.
    console.log(`3. Cargando ${SQL_ORDER.length} scripts SQL...`);

    for (const relativePath of SQL_ORDER) {
      await executeFile(relativePath);
    }

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