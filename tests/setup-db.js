import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga las variables del .env antes de inicializar la conexión
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const execAsync = promisify(exec);

export default async function setupTestDB() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      'FATAL: DATABASE_URL no está definida. Revisa la ubicación de tu archivo .env.'
    );
  }

  const pgClient = new Client({ connectionString: dbUrl });

  try {
    console.log('1. Reseteando base de datos de pruebas con Prisma...');
    await execAsync('npx prisma migrate reset --force --skip-seed');

    console.log('2. Conectando a PostgreSQL para configurar extensiones...');
    await pgClient.connect();

    console.log('3. Habilitando extensiones necesarias...');
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS citext;');

    console.log('4. Cargando funciones SQL personalizadas...');
    const sqlDir = path.resolve(__dirname, '../database/sql/user');
    const filesToRun = [
      '005_password_reset.sql',
      '006_email_verification.sql',
      '007_login_security.sql',
      '008_cleanup_tokens.sql'
    ];

    for (const file of filesToRun) {
      const filePath = path.join(sqlDir, file);
      console.log(`   Executing ${file}...`);
      const sqlContent = await fs.readFile(filePath, 'utf8');
      await pgClient.query(sqlContent);
    }

    console.log('Base de datos de pruebas lista y funcional.');
  } catch (error) {
    console.error('Error configurando la base de datos de pruebas:', error.message);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}