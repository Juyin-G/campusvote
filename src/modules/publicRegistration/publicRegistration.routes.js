// src/modules/publicRegistration/publicRegistration.routes.js
// Rutas PÚBLICAS de inscripción de proyectos: no llevan authenticate, así que
// se montan ANTES del tenantRouter (ver src/routes/index.js).
//
// El prefijo propio (/public/inscripciones) evita pisar /fairs/:id, que sí
// exige sesión.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { validate } from '../../middlewares/validate.middleware.js';
import * as controller from './publicRegistration.controller.js';
import * as schema from './publicRegistration.schema.js';
import env from '../../config/env.js';

const router = Router();

// Los límites se definen aquí (y no en rateLimiter.middleware.js) para que las
// pruebas que simulan ese middleware no queden sin estos handlers.
// En pruebas se relajan: lo que se verifica ahí es la lógica, no el límite.
const esPrueba = env.NODE_ENV === 'test';

const buildLimiter = ({ windowMs, max, message, code }) =>
  rateLimit({
    windowMs,
    max: esPrueba ? 100000 : max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code, message },
        timestamp: new Date().toISOString(),
      }),
  });

// Enviar códigos cuesta correos: pocos por IP y por hora.
const codeLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  code: 'REGISTRATION_CODE_RATE_LIMITED',
  message: 'Pediste demasiados códigos. Espera una hora e inténtalo de nuevo.',
});

// Canjear códigos: freno contra la prueba de códigos al azar (además del
// máximo de intentos por código).
const redeemLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  code: 'REGISTRATION_REDEEM_RATE_LIMITED',
  message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
});

// Escritura del formulario.
const writeLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  code: 'REGISTRATION_WRITE_RATE_LIMITED',
  message: 'Demasiadas solicitudes. Inténtalo más tarde.',
});

// Lectura de la página (nombre de la feria, categorías y colores).
router.get(
  '/public/inscripciones/:token',
  validate(schema.tokenParamSchema),
  controller.getPublicFair
);

// Paso 1: código de verificación al correo institucional.
router.post(
  '/public/inscripciones/:token/codigo',
  codeLimiter,
  validate(schema.requestCodeSchema),
  controller.requestAccessCode
);

// Paso 2: el código se canjea por un permiso temporal.
router.post(
  '/public/inscripciones/:token/sesion',
  redeemLimiter,
  validate(schema.redeemCodeSchema),
  controller.redeemAccessCode
);

// Paso 3: inscripción, consulta y corrección del propio proyecto.
router.get(
  '/public/inscripciones/:token/proyecto',
  validate(schema.tokenParamSchema),
  controller.getMyProject
);

router.post(
  '/public/inscripciones/:token/proyecto',
  writeLimiter,
  validate(schema.createProjectSchema),
  controller.createMyProject
);

router.put(
  '/public/inscripciones/:token/proyecto',
  writeLimiter,
  validate(schema.updateProjectSchema),
  controller.updateMyProject
);

export default router;
