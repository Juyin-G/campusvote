/**
 * Health Service
 * ---------------------------------------------------------------
 * Encapsula la lógica de verificación del estado del sistema:
 *  - Conexión a la base de datos (Prisma)
 *  - Métricas del proceso Node (uptime, memoria)
 *  - Información del entorno
 * ---------------------------------------------------------------
 */

import os from 'os';
import { performance } from 'perf_hooks';
import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';

const startTime = Date.now();

class HealthService {
  /**
   * Obtiene el estado de salud general del sistema.
   * @returns {Promise<Object>} Reporte completo de salud.
   */
  async getHealthStatus() {
    const [dbStatus, dbLatency] = await this.#checkDatabase();

    return {
      status: dbStatus === 'up' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: this.#getUptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
        api: {
          status: 'up',
        },
      },
      system: this.#getSystemMetrics(),
    };
  }

  /**
   * Verifica únicamente la conexión a la base de datos.
   * Útil para health-checks ligeros (liveness probes).
   * @returns {Promise<boolean>}
   */
  async isDatabaseHealthy() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Chequeo profundo de la base de datos con medición de latencia.
   * @private
   * @returns {Promise<[string, number]>} [status, latencyMs]
   */
  async #checkDatabase() {
    const start = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latency = Math.round(performance.now() - start);
      return ['up', latency];
    } catch (error) {
      const latency = Math.round(performance.now() - start);
      logger.error('Database connection error during health check', {
        error: error.message,
        latency,
      });
      return ['down', latency];
    }
  }

  /**
   * Calcula el uptime del proceso en formato legible.
   * @private
   * @returns {string}
   */
  #getUptime() {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  /**
   * Métricas básicas del sistema operativo y del proceso Node.
   * @private
   * @returns {Object}
   */
  #getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      platform: os.platform(),
      nodeVersion: process.version,
      cpuCores: os.cpus().length,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      loadAverage: os.loadavg().map((l) => l.toFixed(2)),
    };
  }
}

export default new HealthService();