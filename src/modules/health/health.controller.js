import { prisma } from '../../database/prisma.js';
import logger from '../../config/logger.js';

export const checkHealth = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

export const checkDatabase = async (req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      data: {
        connected: true,
        latency_ms: latency,
      },
    });
  } catch (error) {
    logger.error('Database health check failed:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database connection failed',
      },
    });
  }
};

export default {
  checkHealth,
  checkDatabase,
};
