// src/jobs/scheduler.js
// Programador de tareas en background. Solo se activa si BACKUP_ENABLED=true.
// No usa dependencias externas: un setInterval simple revisa la hora cada 60s
// y dispara el backup en el horario configurado (BACKUP_CRON_HOUR, por defecto 2).
// Nunca lanza errores que puedan tumbar el proceso.

import { runBackupJob } from './backup.js';
import logger from '../config/logger.js';

let running = false;
let lastRunDate = null;

const HOUR_MS = 60 * 60 * 1000;

const shouldRunToday = () => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const targetHour = parseInt(process.env.BACKUP_CRON_HOUR, 10) || 2;

  if (lastRunDate === todayKey) return false;
  if (now.getHours() !== targetHour) return false;

  lastRunDate = todayKey;
  return true;
};

const tick = async () => {
  if (running || !shouldRunToday()) return;
  running = true;
  try {
    const result = await runBackupJob();
    if (result?.skipped) {
      logger.info('[Scheduler] Backup omitido:', { reason: result.reason });
    } else if (result?.file) {
      logger.info('[Scheduler] Backup programado completado:', { file: result.file });
    }
  } catch (error) {
    logger.error('[Scheduler] Error en backup programado:', { message: error.message });
  } finally {
    running = false;
  }
};

let timer = null;

/**
 * Inicia el scheduler. Devuelve la función de detención.
 */
export const startScheduler = () => {
  const enabled = (process.env.BACKUP_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) {
    logger.info('[Scheduler] BACKUP_ENABLED no está activo. Scheduler deshabilitado.');
    return () => {};
  }

  logger.info('[Scheduler] Scheduler de backups iniciado.');
  timer = setInterval(tick, HOUR_MS);
  timer.unref?.();
  tick(); // Intento inicial (en caso de que ya sea la hora objetivo)

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
};

export default { startScheduler };