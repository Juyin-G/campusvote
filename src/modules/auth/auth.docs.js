/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Iniciar sesión
 *     description: |
 *       Autentica un usuario y retorna un JWT. Si el usuario tiene TOTP habilitado,
 *       devuelve un `tempToken` y `requiresTotp: true`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: |
 *           Inicio de sesión completado (o requiere TOTP).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: |
 *           Datos inválidos. Ver `error.details` con los campos fallidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: |
 *           Credenciales inválidas. Código: INVALID_CREDENTIALS.
 *       423:
 *         description: |
 *           Cuenta bloqueada por múltiples intentos fallidos. Código: ACCOUNT_LOCKED.
 *
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cerrar sesión
 *     description: |
 *       Cierra la sesión del usuario. El cliente debe descartar el token JWT localmente.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           Sesión cerrada correctamente.
 *       401:
 *         description: |
 *           Token JWT ausente, inválido o expirado.
 *
 * /auth/totp/setup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Configurar TOTP
 *     description: |
 *       Genera un secreto y un código QR para vincular una app autenticadora.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           Secreto TOTP generado. Escanea el código QR con tu app autenticadora.
 *       401:
 *         description: |
 *           No autenticado. Códigos: NO_TOKEN, INVALID_TOKEN, TOKEN_EXPIRED.
 *       404:
 *         description: |
 *           Usuario no encontrado o inactivo. Código: USER_NOT_FOUND.
 *       409:
 *         description: |
 *           TOTP ya configurado. Código: TOTP_ALREADY_CONFIGURED.
 *
 * /auth/totp/verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verificar y activar TOTP
 *     description: |
 *       Valida el código TOTP de 6 dígitos y activa la autenticación en dos pasos.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: |
 *           TOTP verificado y habilitado.
 *       400:
 *         description: |
 *           TOTP no configurado o formato de token inválido.
 *       401:
 *         description: |
 *           Código TOTP inválido o expirado.
 *
 * /auth/totp/login-verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Completar login con TOTP
 *     description: |
 *       Intercambia el `tempToken` (propósito TOTP_PENDING) y el código TOTP por el JWT definitivo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: |
 *           Verificación TOTP completada. Sesión iniciada.
 *       400:
 *         description: |
 *           TOTP no configurado o formato de token inválido.
 *       401:
 *         description: |
 *           Código TOTP inválido o token ausente.
 *       403:
 *         description: |
 *           Se requiere una sesión temporal de verificación TOTP. Código: TOTP_SESSION_REQUIRED.
 */
