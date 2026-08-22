// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js'; 
import { TokenExpiredError } from '../shared/errors/TokenExpiredError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Verifica el Bearer token y rellena req.user.
 * Ante cualquier anomalía delega al errorHandler global con AppError.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new ApiError({
        message:
          'No se envió token de autenticación en el header Authorization',
        code: TokenExpiredError.NO_TOKEN,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
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
        new ApiError({
          message: 'El token JWT expiró. Vuelve a iniciar sesión',
          code: TokenExpiredError.TOKEN_EXPIRED,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    if (error.name === 'JsonWebTokenError') {
      return next(
        new ApiError({
          message: 'El token JWT es inválido o está mal formado',
          code: TokenExpiredError.INVALID_TOKEN,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    return next(
      new ApiError({
        message: 'Error de autenticación',
        code: TokenExpiredError.AUTH_ERROR,
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
      new ApiError({
        message: 'No autenticado',
        code: TokenExpiredError.UNAUTHORIZED,
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    );
  }

  if (req.user.purpose !== 'TOTP_PENDING') {
    return next(
      new ApiError({
        message: 'Se requiere una sesión temporal de verificación TOTP',
        code: TokenExpiredError.TOTP_SESSION_REQUIRED,
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
        new ApiError({
          message: 'No autenticado',
          code: TokenExpiredError.UNAUTHORIZED,
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError({
          message: 'No tienes permisos para realizar esta acción',
          code: TokenExpiredError.FORBIDDEN,
          statusCode: HttpStatus.FORBIDDEN,
        }),
      );
    }

    next();
  };
// Fin de archivo