import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js';

/**
 * Verifica el Bearer token y rellena req.user.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      ApiError.unauthorized(
        'No se envió token de autenticación en el header Authorization'
      )
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
        ApiError.invalidToken('El token JWT expiró. Vuelve a iniciar sesión')
      );
    }

    if (error.name === 'JsonWebTokenError') {
      return next(
        ApiError.invalidToken('El token JWT es inválido o está mal formado')
      );
    }

    return next(ApiError.unauthorized('Error de autenticación'));
  }
};

/**
 * Garantiza que el token sea un token temporal de verificación TOTP.
 */
export const requireTotpPending = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  if (req.user.purpose !== 'TOTP_PENDING') {
    return next(
      ApiError.forbidden('Se requiere una sesión temporal de verificación TOTP')
    );
  }

  next();
};

/**
 * Restringe el acceso a uno o más roles.
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden('No tienes permisos para realizar esta acción')
    );
  }

  next();
};