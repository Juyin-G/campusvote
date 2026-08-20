import { Router } from 'express';

import {
  authenticate,
  requireTotpPending,
} from '../middlewares/auth.middleware.js';

import { validate } from '../middlewares/validate.middleware.js';

import {
  login,
  logout,
  setupTotp,
  verifyTotp,
  verifyLoginTotp,
} from '../modules/auth/auth.controller.js';

import {
  loginSchema,
  totpTokenSchema,
} from '../modules/auth/auth.schema.js';

const router = Router();

router.post(
  '/login',
  validate(loginSchema),
  login,
);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cerrar sesión
 *     description: Invalida la sesión del cliente. El token JWT debe enviarse en el header Authorization.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *       401:
 *         description: Token inválido, expirado o no enviado
 */
router.post(
  '/logout',
  authenticate,
  logout,
);

/**
 * @openapi
 * /api/auth/totp/setup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Configurar TOTP
 *     description: Genera un secret y un QR para configurar una aplicación autenticadora
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración TOTP generada correctamente
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Usuario no encontrado o inactivo
 *       409:
 *         description: TOTP ya configurado
 */
router.post(
  '/totp/setup',
  authenticate,
  setupTotp,
);

/**
 * @openapi
 * /api/auth/totp/verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verificar código TOTP
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: TOTP verificado correctamente
 *       400:
 *         description: Datos inválidos o TOTP no configurado
 *       401:
 *         description: Código TOTP inválido
 */
router.post(
  '/totp/verify',
  authenticate,
  validate(totpTokenSchema),
  verifyTotp,
);

/**
 * @openapi
 * /api/auth/totp/login-verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Completar login con TOTP
 *     description: Verifica el código TOTP mediante un token temporal y devuelve el JWT definitivo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Autenticación TOTP completada
 *       400:
 *         description: Datos inválidos o TOTP no configurado
 *       401:
 *         description: Código o token inválido
 *       403:
 *         description: Se requiere sesión temporal TOTP
 */
router.post(
  '/totp/login-verify',
  authenticate,
  requireTotpPending,
  validate(totpTokenSchema),
  verifyLoginTotp,
);

export default router;