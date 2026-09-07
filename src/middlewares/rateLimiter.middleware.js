import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 5, // Límite de 5 intentos por IP
  message: {
    status: 'error',
    message: 'Demasiados intentos de inicio de sesión. Por favor, reintente en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // Ventana de 1 hora
  max: 10, // Límite de 10 peticiones
  message: {
    status: 'error',
    message: 'Demasiadas solicitudes enviadas desde esta IP. Intente más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
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
    message: message || {
      status: 'error',
      message: 'Demasiadas solicitudes. Intente más tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getUserId(req)}`,
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
    message: message || {
      status: 'error',
      message: 'Demasiadas solicitudes para esta elección. Intente más tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getUserId(req)}:${getElectionId(req)}`,
  });