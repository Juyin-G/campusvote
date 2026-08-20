// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { AppError } from '../common/errors/AppError.js';
import { ErrorCodes } from '../common/errors/errorCodes.js';
import { HttpStatus } from '../common/errors/httpStatus.js';

/**
 * Verifica el Bearer token y rellena req.user.
 * Ante cualquier anomalía delega al errorHandler global con AppError.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError({
        message:
          'No se envió token de autenticación en el header Authorization',
        code: ErrorCodes.NO_TOKEN,
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    );
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(
        new AppError({
          message: 'El token JWT expiró. Vuelve a iniciar sesión',
          code: ErrorCodes.TOKEN_EXPIRED,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    if (error.name === 'JsonWebTokenError') {
      return next(
        new AppError({
          message: 'El token JWT es inválido o está mal formado',
          code: ErrorCodes.INVALID_TOKEN,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    return next(
      new AppError({
        message: 'Error de autenticación',
        code: ErrorCodes.AUTH_ERROR,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      }),
    );
  }
};

/**
 * Garantiza que el token sea un token temporal de verificación TOTP.
 */
export const requireTotpPending = (req, res, next) => {
  if (!req.user) {
    return next(
      new AppError({
        message: 'No autenticado',
        code: ErrorCodes.UNAUTHORIZED,
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    );
  }

  if (req.user.purpose !== 'TOTP_PENDING') {
    return next(
      new AppError({
        message: 'Se requiere una sesión temporal de verificación TOTP',
        code: ErrorCodes.TOTP_SESSION_REQUIRED,
        statusCode: HttpStatus.FORBIDDEN,
      }),
    );
  }

  next();
};

/**
 * Restringe el acceso a uno o más roles.
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError({
          message: 'No autenticado',
          code: ErrorCodes.UNAUTHORIZED,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError({
          message: 'No tienes permisos para realizar esta acción',
          code: ErrorCodes.FORBIDDEN,
          statusCode: HttpStatus.FORBIDDEN,
        }),
      );
    }

    next();
  };
// Fin de archivo