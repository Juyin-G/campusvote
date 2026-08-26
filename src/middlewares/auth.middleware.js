import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js';

/**
 * Verifica el Bearer token y rellena req.user.
 * Rechaza tokens con purpose='TOTP_PENDING' para prevenir bypass de MFA.
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.allowPending - Si true, permite tokens TOTP_PENDING
 */
const createAuthenticateMiddleware = (options = {}) => (req, res, next) => {
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
    // Se fija el algoritmo de forma explícita: aceptar cualquiera permitiría
    // que un cambio futuro de librería reabra los ataques de confusión de
    // algoritmo. La firma siempre se emite con HS256 en auth.helpers.js.
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    
    // Rechazar tokens TOTP_PENDING en rutas ordinarias (a menos que allowPending=true)
    if (decoded.purpose === 'TOTP_PENDING' && !options.allowPending) {
      return next(
        ApiError.forbidden(
          'Debes completar la verificación de dos factores para acceder a este recurso'
        )
      );
    }
    
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
 * Middleware de autenticación estándar que rechaza tokens TOTP_PENDING.
 */
export const authenticate = createAuthenticateMiddleware({ allowPending: false });

/**
 * Middleware de autenticación que permite tokens TOTP_PENDING.
 * Solo debe usarse en la ruta de verificación TOTP.
 */
export const authenticateAllowPending = createAuthenticateMiddleware({ allowPending: true });

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