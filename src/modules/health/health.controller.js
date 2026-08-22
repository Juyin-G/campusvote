import { prisma } from '../../database/prisma.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { asyncHandler  } from '../../middlewares/errorHandler.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { TokenExpiredError } from '../../shared/errors/TokenExpiredError.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

export const checkHealth = asyncHandler ((req, res) => {
  return sendSuccess (res, {
    message: 'Servicio operativo',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    requestId: req.requestId,
  });
});

export const checkDatabase = asyncHandler (async (req, res) => {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return sendSuccess (res, {
      message: 'Conexión a la base de datos verificada',
      data: {
        connected: true,
        latency_ms: latency,
      },
      requestId: req.requestId,
    });
  } catch {
    throw new ApiError({
      message: 'No se pudo conectar con la base de datos',
      code: TokenExpiredError.DATABASE_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    });
  }
});

export default {
  checkHealth,
  checkDatabase,
};
