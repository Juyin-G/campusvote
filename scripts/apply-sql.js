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

import { SQL_ORDER } from './sql-order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Orden de ejecución canónico (idéntico a tests/setup-db.js).
const MIGRATION_FILES = SQL_ORDER;

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('FATAL: MIGRATION_DATABASE_URL o DATABASE_URL no está configurada.');
  process.exit(1);
}

const sqlRoot = path.resolve(__dirname, '../database/sql');

// Render y la mayoría de proveedores exigen TLS en las conexiones externas,
// y usan certificados propios que no están en el almacén del sistema. En
// local (Docker) no hay TLS, así que se desactiva.
const esLocal = /localhost|127.0.0.1/.test(DATABASE_URL);

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: esLocal ? false : { rejectUnauthorized: false },
});

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