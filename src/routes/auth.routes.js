import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { login, logout } from '../modules/auth/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout exitoso
 *                 data:
 *                   type: object
 *                   properties:
 *                     loggedOut:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Token inválido, expirado o no enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticate, logout);

export default router;
