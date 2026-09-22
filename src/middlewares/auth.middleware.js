import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';

/**
 * Verifica el Bearer token y rellena req.user.
 * Rechaza tokens con purpose='TOTP_PENDING' para prevenir bypass de MFA.
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.allowPending - Si true, permite tokens TOTP_PENDING
 */
/**
 * Tokens de alcance limitado (flujo temporal): no pueden acceder a rutas
 * ordinarias a menos que el middleware lo permita explícitamente.
 * - TOTP_PENDING: tras ingresar credenciales, antes de completar 2FA.
 * - ONBOARDING: primer acceso de un administrador (activación por email o
 *   credenciales temporales) mientras configura 2FA y su contraseña.
 */
const LIMITED_PURPOSES = ['TOTP_PENDING', 'ONBOARDING'];

const createAuthenticateMiddleware = (options = {}) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('campusvote_access='))
    ?.slice('campusvote_access='.length);

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !cookieToken) {
    return next(
      ApiError.unauthorized(
        'No se envió token de autenticación en el header Authorization'
      )
    );
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

  try {
    // Se fija el algoritmo de forma explícita: aceptar cualquiera permitiría
    // que un cambio futuro de librería reabra los ataques de confusión de
    // algoritmo. La firma siempre se emite con HS256 en auth.helpers.js.
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

    // Rechazar tokens de flujo temporal (TOTP_PENDING / ONBOARDING) en rutas
    // ordinarias (a menos que allowPending=true)
    if (LIMITED_PURPOSES.includes(decoded.purpose) && !options.allowPending) {
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
 * Alias de retrocompatibilidad: el export se denominaba `authenticateToken`
 * antes de la refactorización de nombres. Se conserva para imports vigentes
 * (fairResult.routes.js y suites de pruebas).
 */
export const authenticateToken = authenticate;

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
 * Garantiza que el token sea una sesión temporal de onboarding (ONBOARDING).
 */
export const requireOnboarding = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  if (req.user.purpose !== 'ONBOARDING') {
    return next(
      ApiError.forbidden('Se requiere una sesión temporal de onboarding')
    );
  }

  next();
};

/**
 * CAMBIO: helper documentado. authorizeTenant(roles) está pensado para
 * rutas de negocio (ferias, elecciones, votaciones). NUNCA debe recibir
 * SUPERADMIN porque la frontera se aplica en src/routes/index.js.
 */
export const authorizeTenant = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  if (allowedRoles.includes(ROLES.SUPERADMIN)) {
    // CAMBIO: guardia dura en desarrollo. Rompe en build para impedir
    // regresión silenciosa al patrón anterior.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[authorizeTenant] SUPERADMIN detectado en una ruta de tenant. Migra a authorizePlatform().'
      );
    }
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden('No tienes permisos para realizar esta acción')
    );
  }

  next();
};

/**
 * Alias de retrocompatibilidad: export histórico que se usaba como guard de
 * roles en rutas de negocio; ahora delega en authorizeTenant(), designado
 * para rutas de tenant (ferias/proyectos). Conserva imports vigentes.
 */
export const authorizeRoles = authorizeTenant;

/**
 * CAMBIO: authorizePlatform(roles) está pensado para rutas macro
 * (/api/organizations, /api/admin/*, /api/users/admin/provision*).
 * Aquí SÍ se permite SUPERADMIN como único actor.
 */
export const authorizePlatform = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden('No tienes permisos para realizar esta acción en la plataforma')
    );
  }

  next();
};

/**
 * CAMBIO: authorize() se conserva por compatibilidad con módulos legacy,
 * pero internamente delega en authorizeTenant() para impedir SUPERADMIN en
 * el cuerpo del array. Los call sites existentes con
 * authorize([ADMIN, SUPERADMIN]) deben migrarse a authorizePlatform() y
 * mover la ruta al sub-router PLATFORM.
 */
export const authorize = (...roles) => {
  if (roles.flat().includes(ROLES.SUPERADMIN)) {
    // No rompemos en runtime; emitimos warning para que CI/QA lo detecte.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[authorize] SUPERADMIN detectado en una llamada authorize(). Migra esta ruta a authorizePlatform() y móntala bajo /api/platform/* o en platformRouter.'
      );
    }
  }
  return authorizeTenant(...roles);
};
