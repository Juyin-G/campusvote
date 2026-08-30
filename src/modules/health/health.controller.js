import { prisma } from '../../database/prisma.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

export const checkHealth = asyncHandler((req, res) => {
  return sendSuccess(
    res,
    {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    'Servicio operativo',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const checkDatabase = asyncHandler(async (req, res) => {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return sendSuccess(
      res,
      {
        connected: true,
        latency_ms: latency,
      },
      'Conexión a la base de datos verificada',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  } catch {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'No se pudo conectar con la base de datos',
      null,
      'DATABASE_ERROR'
    );
  }
});

export default {
  checkHealth,
  checkDatabase,
};
