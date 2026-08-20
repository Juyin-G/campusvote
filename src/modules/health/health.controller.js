import { prisma } from '../../database/prisma.js';
import { ok } from '../../common/helpers/response.helper.js';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { AppError } from '../../common/errors/AppError.js';
import { ErrorCodes } from '../../common/errors/errorCodes.js';
import { HttpStatus } from '../../common/errors/httpStatus.js';

export const checkHealth = asyncHandler((req, res) => {
  return ok(res, {
    message: 'Servicio operativo',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    requestId: req.requestId,
  });
});

export const checkDatabase = asyncHandler(async (req, res) => {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return ok(res, {
      message: 'Conexión a la base de datos verificada',
      data: {
        connected: true,
        latency_ms: latency,
      },
      requestId: req.requestId,
    });
  } catch {
    throw new AppError({
      message: 'No se pudo conectar con la base de datos',
      code: ErrorCodes.DATABASE_ERROR,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
});

export default {
  checkHealth,
  checkDatabase,
};
