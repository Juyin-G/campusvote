import { Router } from 'express';
import * as otpController from '../controllers/otp.controller.js';
import { verifyTotpSchema, verifyLoginSchema, disableTotpSchema } from '../schemas/otp.schema.js';
import { authenticate, authenticateAllowPending, requireTotpPending } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { authLimiter, loginLimiter } from '../../../middlewares/rateLimiter.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/auth/otp/setup:
 *   post:
 *     summary: Iniciar configuración de 2FA
 *     description: Genera el secreto TOTP y la URI para generar el código QR en la app autenticadora.
 *     tags: [OTP - Two Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secreto TOTP y URI generados exitosamente.
 *       401:
 *         description: Token no provisto o inválido.
 *       409:
 *         description: El usuario ya tiene 2FA activado.
 *       429:
 *         description: Demasiadas solicitudes. Intente más tarde.
 */
router.post('/setup', authenticate, authLimiter, otpController.setupTotp);

/**
 * @openapi
 * /api/auth/otp/verify:
 *   post:
 *     summary: Verificar código y habilitar 2FA
 *     description: Valida el código TOTP de 6 dígitos ingresado por primera vez y habilita definitivamente el 2FA.
 *     tags: [OTP - Two Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA activado exitosamente. Retorna los códigos de respaldo.
 *       400:
 *         description: Código TOTP inválido o la configuración no ha sido iniciada.
 *       401:
 *         description: Token no provisto o inválido.
 *       429:
 *         description: Demasiadas solicitudes. Intente más tarde.
 */
router.post('/verify', authenticate, authLimiter, validate(verifyTotpSchema), otpController.verifyTotp);

/**
 * @openapi
 * /api/auth/otp/verify-login:
 *   post:
 *     summary: Verificar TOTP durante login
 *     description: Valida un código TOTP de 6 dígitos o un código de respaldo de 8 caracteres.
 *     tags: [OTP - Two Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *               backupCode:
 *                 type: string
 *                 example: "A1B2C3D4"
 *     responses:
 *       200:
 *         description: Verificación exitosa.
 *       400:
 *         description: Código TOTP o de respaldo inválido o 2FA no habilitado.
 *       401:
 *         description: Token no provisto o inválido.
 *       429:
 *         description: Demasiados intentos de inicio de sesión.
 */
router.post(
  '/verify-login',
  loginLimiter,
  authenticateAllowPending,
  requireTotpPending,
  validate(verifyLoginSchema),
  otpController.verifyLoginTotp
);

/**
 * @openapi
 * /api/auth/otp/disable:
 *   post:
 *     summary: Deshabilitar 2FA
 *     description: Desactiva la autenticación en dos pasos previa confirmación de la contraseña actual del usuario.
 *     tags: [OTP - Two Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "Password123!"
 *     responses:
 *       200:
 *         description: 2FA deshabilitado exitosamente.
 *       400:
 *         description: El usuario no tiene 2FA habilitado o la contraseña es incorrecta.
 *       401:
 *         description: Token no provisto, inválido o contraseña incorrecta.
 *       429:
 *         description: Demasiadas solicitudes. Intente más tarde.
 */
router.post(
  '/disable',
  authenticate,
  authLimiter,
  validate(disableTotpSchema),
  otpController.disableTotp
);

export default router;