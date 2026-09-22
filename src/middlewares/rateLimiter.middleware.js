import rateLimit from 'express-rate-limit';
import { ApiError } from '../shared/errors/ApiError.js';

/**
 * Handler común para TODOS los limitadores del proyecto (PASO 8.3).
 *
 * - Delega en el error handler global para que el formato de respuesta 429
 *   sea idéntico al resto de errores de la API
 *   ({ success: false, error: { code, message }, timestamp, path }).
 * - Conserva los headers `RateLimit-*` y `Retry-After` que express-rate-limit
 *   establece automáticamente ANTES de invocar `handler`.
 *
 * @param {string} code        Código interno estable para distinguir tipo de límite.
 * @param {string} fallbackMsg Mensaje por defecto si la librería no trae uno.
 */
const buildRateLimitHandler = (code, fallbackMsg) => (req, res, next, options) => {
  // El header Retry-After ya fue seteado por express-rate-limit antes de
  // llamar a este handler (ver node_modules/express-rate-limit/dist/index.cjs).
  const customMessage =
    options?.message && typeof options.message === 'object'
      ? options.message.message
      : typeof options?.message === 'string'
        ? options.message
        : null;

  const message = customMessage || fallbackMsg;
  const retryAfterSeconds = Math.ceil((options?.windowMs || 0) / 1000);

  next(
    ApiError.tooManyRequests(
      message,
      { retryAfterSeconds, code },
      code
    )
  );
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 5, // Límite de 5 intentos por IP
  message: 'Demasiados intentos de inicio de sesión. Por favor, reintente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('LOGIN_RATE_LIMITED', 'Demasiados intentos de inicio de sesión. Por favor, reintente en 15 minutos.'),
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // Ventana de 1 hora
  max: 10, // Límite de 10 peticiones
  message: 'Demasiadas solicitudes enviadas desde esta IP. Intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('AUTH_RATE_LIMITED', 'Demasiadas solicitudes enviadas desde esta IP. Intente más tarde.'),
});

// ── Limitadores por USUARIO (mejora §29.1 / sugerencia #1) ──────────
// Defensa en profundidad sobre el anti-doble-voto (token de un solo uso):
// clave = userId para endpoints sin electionId explícito (p.ej. cast de
// una sesión), o userId:electionId en endpoints identificables.

const getUserId = (req) => {
  return String(req?.user?.userId ?? req?.user?.id ?? 'anon');
};

const getElectionId = (req) => {
  return String(
    req?.params?.id ||
      req?.params?.electionId ||
      req?.query?.election_id ||
      req?.params?.election_id ||
      'global'
  );
};

/**
 * Límite por usuario (clave `userId`).
 * @param {number} windowMs ventana en ms
 * @param {number} max     máximo de peticiones en la ventana
 */
export const userLimiter = ({ windowMs = 60 * 60 * 1000, max = 60, message } = {}) =>
  rateLimit({
    windowMs,
    max,
    message: message || 'Demasiadas solicitudes. Intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getUserId(req)}`,
    handler: buildRateLimitHandler(
      'USER_RATE_LIMITED',
      message || 'Demasiadas solicitudes. Intente más tarde.'
    ),
  });

/**
 * Límite por usuario+elección (clave `userId:electionId`).
 * Se monta DESPUÉS de `authenticate`, por lo que req.user ya existe.
 */
export const userElectionLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    message: message || 'Demasiadas solicitudes para esta elección. Intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getUserId(req)}:${getElectionId(req)}`,
    handler: buildRateLimitHandler(
      'USER_ELECTION_RATE_LIMITED',
      message || 'Demasiadas solicitudes para esta elección. Intente más tarde.'
    ),
  });