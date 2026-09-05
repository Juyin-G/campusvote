// src/jobs/scheduler.js
// Programador de tareas en background. Respeta BACKUP_ENABLED=true para el
// respaldo diario y NOTIFICATION_WORKER_ENABLED=true para despachar la cola
// de notificaciones (deliveries PENDING). Un setInterval simple; nunca lanza
// errores que puedan tumbar el proceso.

import { runBackupJob } from './backup.js';
import { processPendingDeliveries } from '../modules/notification/notification.service.js';
import logger from '../config/logger.js';

let running = false;
let lastRunDate = null;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

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

const notificationTick = async () => {
  try {
    const result = await processPendingDeliveries({ limit: 100 });
    if (result.processed > 0) {
      logger.info('[NotificationWorker] Entregas despachadas:', result);
    }
  } catch (error) {
    logger.error('[NotificationWorker] Error procesando cola:', { message: error.message });
  }
};

let timer = null;
let notificationTimer = null;

/**
 * Inicia el scheduler. Devuelve la función de detención.
 */
export const startScheduler = () => {
  const backupEnabled = (process.env.BACKUP_ENABLED || '').toLowerCase() === 'true';
  const workerEnabled = (process.env.NOTIFICATION_WORKER_ENABLED || '').toLowerCase() === 'true';

  if (!backupEnabled && !workerEnabled) {
    logger.info(
      '[Scheduler] BACKUP_ENABLED y NOTIFICATION_WORKER_ENABLED desactivados. Scheduler inactivo.'
    );
    return () => {};
  }

  if (backupEnabled) {
    logger.info('[Scheduler] Scheduler de backups iniciado.');
    timer = setInterval(tick, HOUR_MS);
    timer.unref?.();
    tick();
  }

  if (workerEnabled) {
    logger.info('[Scheduler] Worker de notificaciones iniciado.');
    notificationTimer = setInterval(notificationTick, MINUTE_MS);
    notificationTimer.unref?.();
    notificationTick();
  }

  return () => {
    if (timer) clearInterval(timer);
    if (notificationTimer) clearInterval(notificationTimer);
    timer = null;
    notificationTimer = null;
  };
};

export default { startScheduler };