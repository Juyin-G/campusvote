// src/jobs/backup.js
// Backups por pg_dump a un directorio local (con retención), activados
// SOLO cuando BACKUP_ENABLED=true. Si pg_dump no está disponible, el job
// se omite con un log (nunca rompe el arranque ni el ciclo de la app).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import logger from '../config/logger.js';

/* eslint-disable security/detect-non-literal-fs-filename -- la ruta de backup se configura por BACKUP_DIR en el entorno */
const execFileAsync = promisify(execFile);

/**
 * Descompone DATABASE_URL (postgres://user:pass@host:port/db) en parámetros
 * compatibles con pg_dump. Retorna null si la URL es inválida.
 */
export const parseDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
};

/**
 * Encuentra el binario pg_dump (variable PG_DUMP_PATH o el propio PATH).
 */
const findPgDump = async () => {
  const candidates = process.env.PG_DUMP_PATH
    ? [process.env.PG_DUMP_PATH]
    : ['pg_dump'];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version']);
      return candidate;
    } catch {
      // Continuar con el siguiente candidato
    }
  }
  return null;
};

/**
 * Ejecuta un backup lógico con pg_dump (formato custom `-Fc`) en BACKUP_DIR.
 * Retorna la ruta del archivo, o null (más un log) si no se pudo ejecutar.
 */
export const runBackupJob = async () => {
  if ((process.env.BACKUP_ENABLED || '').toLowerCase() !== 'true') {
    return { skipped: true, reason: 'BACKUP_ENABLED no está activo' };
  }

  const pgDump = await findPgDump();
  if (!pgDump) {
    logger.warn('[Backup] pg_dump no está disponible. Omitiendo backup (use PG_DUMP_PATH o instale el cliente Postgres).');
    return { skipped: true, reason: 'pg_dump no disponible' };
  }

  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!parsed) {
    logger.error('[Backup] DATABASE_URL inválida. No se puede ejecutar el backup.');
    return { skipped: true, reason: 'DATABASE_URL inválida' };
  }

  const dir = process.env.BACKUP_DIR || path.join(os.tmpdir(), 'campusvote-backups');
  await fs.mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = path.join(dir, `backup_${timestamp}.dump`);

  const args = [
    '-h', parsed.host,
    '-p', parsed.port,
    '-U', parsed.user,
    '-d', parsed.database,
    '-Fc',
    '-b',
    '-f', dumpPath,
  ];

  const env = { ...process.env, PGPASSWORD: parsed.password };

  try {
    await execFileAsync(pgDump, args, { env, maxBuffer: 1024 * 1024 * 1024 });
    logger.info(`[Backup] Backup creado: ${dumpPath}`);

    // Retención: conservar solo las últimas BACKUP_KEEP copias.
    const keep = parseInt(process.env.BACKUP_KEEP, 10) || 7;
    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith('backup_') && f.endsWith('.dump'))
      .sort();
    while (files.length > keep) {
      const oldest = files.shift();
      await fs.unlink(path.join(dir, oldest)).catch(() => {});
      logger.info(`[Backup] Backup antiguo eliminado: ${oldest}`);
    }

    return { file: dumpPath };
  } catch (error) {
    logger.error('[Backup] Error ejecutando pg_dump:', {
      message: error.message,
      stderr: error.stderr ? String(error.stderr) : undefined,
    });
    return { skipped: true, reason: 'Error ejecutando pg_dump' };
  }
};

export default { runBackupJob, parseDatabaseUrl };