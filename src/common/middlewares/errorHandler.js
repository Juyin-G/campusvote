import { ZodError } from 'zod';

import logger from '../../config/logger.js';
import { ErrorCodes } from '../errors/errorCodes.js';
import { HttpStatus } from '../errors/httpStatus.js';
import { AppError } from '../errors/AppError.js';
import { fail } from '../helpers/response.helper.js';

/**
 * Convierte cualquier error inesperado en una respuesta JSON consistente.
 * - AppError: usa code, statusCode y details.
 * - ZodError: lo transforma en AppError de validación.
 * - Resto: 500 con INTERNAL_ERROR y log estructurado.
 */
export const errorHandler = (err, req, res, next) => {
  void next;

  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return fail(res, {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Los datos enviados no son válidos',
      details,
      requestId,
    });
  }

  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error', {
      requestId,
      status: err.statusCode,
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
    });

    return fail(res, {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    });
  }

  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return fail(res, {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Error interno del servidor',
    requestId,
  });
};
