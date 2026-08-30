/**
 * @file apply-sql.js
 * @description Aplica el esquema SQL completo a la base indicada en DATABASE_URL.
 *
 * Sustituye a scripts/db-setup.ps1 fuera de desarrollo: aquel usa PowerShell y
 * `docker exec` contra el contenedor local, así que no funciona en Render ni en
 * ningún entorno Linux sin Docker. Este script solo necesita Node y el driver
 * `pg`, de modo que sirve igual en Windows, Linux y el propio Render.
 *
 * NUNCA borra nada: los .sql usan CREATE ... IF NOT EXISTS, CREATE OR REPLACE
 * y bloques DO/EXCEPTION, así que puede ejecutarse las veces que haga falta.
 * El DROP SCHEMA que hace tests/setup-db.js es exclusivo del entorno de tests.
 *
 * Uso:
 *   node scripts/apply-sql.js
 *   node scripts/apply-sql.js --dry-run    (lista los archivos sin ejecutarlos)
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { SQL_ORDER } from './sql-order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_ROOT = path.resolve(__dirname, '../database/sql');

const DRY_RUN = process.argv.includes('--dry-run');

/** Oculta la contraseña para poder mostrar a qué base se conecta. */
const destinoLegible = (url) => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(URL no interpretable)';
  }
};

const main = async () => {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL no está definida.');
    console.error('En Render se configura en Environment Variables.');
    process.exit(1);
  }

  console.log('Aplicando esquema SQL de CampusVote');
  console.log(`  destino : ${destinoLegible(DATABASE_URL)}`);
  console.log(`  archivos: ${SQL_ORDER.length}`);
  if (DRY_RUN) console.log('  modo    : simulación (no se ejecuta nada)\n');
  else console.log('');

  // Se comprueba que existan todos antes de tocar la base: es preferible
  // fallar sin haber aplicado nada que dejar el esquema a medias.
  const faltantes = [];
  for (const relativo of SQL_ORDER) {
    try {
      await fs.access(path.join(SQL_ROOT, relativo));
    } catch {
      faltantes.push(relativo);
    }
  }

  if (faltantes.length > 0) {
    console.error('ERROR: faltan archivos SQL declarados en el orden:');
    faltantes.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  if (DRY_RUN) {
    SQL_ORDER.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));
    console.log('\nSimulación completada. Todos los archivos existen.');
    return;
  }

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    // Render exige TLS y usa certificados propios en la red interna.
    ssl: DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });

  await client.connect();

  let aplicados = 0;

  try {
    for (const relativo of SQL_ORDER) {
      const sql = await fs.readFile(path.join(SQL_ROOT, relativo), 'utf8');
      process.stdout.write(`  ${String(++aplicados).padStart(2)}/${SQL_ORDER.length}  ${relativo} ... `);
      await client.query(sql);
      console.log('OK');
    }

    console.log(`\nEsquema aplicado correctamente (${aplicados} archivos).`);
  } catch (error) {
    console.log('FALLO');
    console.error(`\nERROR al aplicar ${SQL_ORDER[aplicados - 1]}:`);
    console.error(`  ${error.message}`);
    if (error.detail) console.error(`  detalle: ${error.detail}`);
    console.error('\nNo se aplicaron los archivos restantes.');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error('ERROR inesperado:', error.message);
  process.exit(1);
});
