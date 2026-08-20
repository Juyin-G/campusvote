import { Router } from 'express';
import * as otpController from '../controllers/otp.controller.js';
import { verifyTotpSchema, verifyLoginSchema, disableTotpSchema } from '../schemas/otp.schema.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';

const router = Router();

// Todas las rutas OTP requieren autenticación previa
router.use(authenticate);

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
 */
router.post('/setup', otpController.setupTotp);

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
 */
router.post('/verify', validate(verifyTotpSchema), otpController.verifyTotp);

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
 */
router.post(
  '/verify-login',
  validate(verifyLoginSchema),
  otpController.verifyLoginTotp
);

/**
 * @openapi
 * /api/auth/otp/disable:
 *   post:
 *     summary: Deshabilitar 2FA
 *     description: Desactiva la autenticación en dos pasos y elimina el secreto e historial de códigos de respaldo.
 *     tags: [OTP - Two Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: "Password123!"
 *     responses:
 *       200:
 *         description: 2FA deshabilitado exitosamente.
 *       400:
 *         description: El usuario no tiene 2FA habilitado.
 *       401:
 *         description: Token no provisto o inválido.
 */
router.post(
  '/disable',
  validate(disableTotpSchema),
  otpController.disableTotp
);

export default router;