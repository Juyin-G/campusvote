/**
 * @file errorHandler.js
 * @description Middleware global de manejo de errores para la API CAMPUSVOTE
 *
 * @module middlewares/errorHandler
 */

import { Prisma } from '@prisma/client';
import { ApiError } from '../shared/errors/ApiError.js';
import { MESSAGES } from '../constants/index.js';
import logger from '../config/logger.js';

/**
 * Códigos de error de Prisma mapeados a errores HTTP
 */
const PRISMA_ERROR_MAP = {
  P2002: {
    status: 409,
    message: 'Ya existe un registro con esos datos (duplicado)',
  },
  P2025: {
    status: 404,
    message: MESSAGES.COMMON.NOT_FOUND,
  },
  P2003: {
    status: 400,
    message: 'Referencia inválida a otro registro',
  },
  P2012: {
    status: 400,
    message: 'Falta un valor requerido',
  },
  P2019: {
    status: 400,
    message: 'Valor fuera de rango permitido',
  },
  P1001: {
    status: 503,
    message: MESSAGES.COMMON.SERVICE_UNAVAILABLE,
  },
  P1008: {
    status: 504,
    message: 'Tiempo de espera agotado en la base de datos',
  },
};

const getJwtErrorStatus = () => 401;

export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    404,
    `La ruta ${req.method} ${req.originalUrl} no fue encontrada`,
    null,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode;
  let message;
  let code;
  let details = null;

  // 1. ERRORES CONOCIDOS (ApiError)
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'KNOWN_ERROR';
    details = err.details;

    if (statusCode >= 500) {
      logger.error({
        message: err.message,
        code: err.code,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
      });
    } else {
      logger.warn({
        message: err.message,
        code: err.code,
        path: req.originalUrl,
        method: req.method,
      });
    }
  }

  // 2. ERRORES DE PRISMA (Base de Datos)
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const pgMessage = typeof err.meta?.message === 'string' ? err.meta.message : '';

    if (err.code === 'P2010') {
      statusCode = 500;
      code = 'DATABASE_QUERY_FAILED';
      message =
        process.env.NODE_ENV === 'development' && pgMessage
          ? `Error en consulta SQL: ${pgMessage}`
          : MESSAGES.COMMON.INTERNAL_SERVER_ERROR;
      details =
        process.env.NODE_ENV === 'development'
          ? { prismaCode: err.code, pgMessage }
          : { prismaCode: err.code };
    } else {
      const prismaError = PRISMA_ERROR_MAP[err.code];

      if (prismaError) {
        statusCode = prismaError.status;
        message = prismaError.message;
        code = `PRISMA_${err.code}`;
        details = {
          prismaCode: err.code,
          target: err.meta?.target,
        };
      } else {
        statusCode = 500;
        message = 'Error en la base de datos';
        code = `PRISMA_${err.code}`;
        details = { prismaCode: err.code };
      }
    }

    logger.error({
      message: `Prisma Error [${err.code}]: ${err.message}`,
      code: err.code,
      meta: err.meta,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // 3. ERRORES DE VALIDACIÓN DE PRISMA
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = MESSAGES.COMMON.BAD_REQUEST;
    code = 'PRISMA_VALIDATION_ERROR';
    details = { validationMessage: err.message };

    logger.error({
      message: `Prisma Validation Error: ${err.message}`,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // 4. ERRORES DE JWT (Autenticación)
  else if (
    err.name === 'TokenExpiredError' ||
    err.name === 'JsonWebTokenError' ||
    err.name === 'NotBeforeError'
  ) {
    statusCode = getJwtErrorStatus();
    message = err.name === 'TokenExpiredError' 
      ? MESSAGES.AUTH.TOKEN_EXPIRED 
      : MESSAGES.AUTH.TOKEN_INVALID;
    code = 'JWT_ERROR';
    details = { jwtError: err.name };

    logger.warn({
      message: `JWT Error: ${err.name}`,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // 5. ERRORES DE SINTAXIS JSON
  else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = MESSAGES.COMMON.BAD_REQUEST;
    code = 'INVALID_JSON';

    logger.warn({
      message: 'JSON parse error',
      path: req.originalUrl,
      method: req.method,
    });
  }

  // 6. ERRORES DE VALIDACIÓN (Zod)
  else if (err.name === 'ZodError') {
    statusCode = 400;
    message = MESSAGES.COMMON.BAD_REQUEST;
    code = 'VALIDATION_ERROR';
    details = err.errors?.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn({
      message: 'Validation error',
      errors: details,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // 7. ERRORES DESCONOCIDOS
  else {
    statusCode = err.statusCode || err.status || 500;
    message = err.message || MESSAGES.COMMON.INTERNAL_SERVER_ERROR;
    code = err.code || 'UNKNOWN_ERROR';
    details = err.details || null;

    logger.error({
      message: `Unhandled error: ${err.message}`,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
      statusCode,
    });
  }

  // RESPUESTA AL CLIENTE
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && err.stack && {
        stack: err.stack,
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};