// src/modules/health/health.controller.js
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger.js';

const prisma = new PrismaClient();

export const checkHealth = (req, res) => {
  res.json({
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

    res.json({
      success: true,
      message: 'Database connection successful',
      data: {
        connected: true,
        latency,
      },
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(500).json({
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