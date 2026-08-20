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