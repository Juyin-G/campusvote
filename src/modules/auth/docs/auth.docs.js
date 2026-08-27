/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Registrar usuario
 *     description: Registra una nueva cuenta de usuario en la plataforma.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, firstName, lastName, institutionalId]
 *             properties:
 *               username:
 *                 type: string
 *                 example: "johndoe"
 *               email:
 *                 type: string
 *                 example: "johndoe@universidad.edu"
 *               password:
 *                 type: string
 *                 example: "Password123!"
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               institutionalId:
 *                 type: string
 *                 example: "20241001"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente.
 *       400:
 *         description: Datos de registro inválidos o el usuario/email ya existe.
 *       429:
 *         description: Demasiadas solicitudes de registro. Intente más tarde.
 *
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
 *       429:
 *         description: Demasiados intentos de inicio de sesión. Intente más tarde.
 *
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cerrar sesión
 *     description: |
 *       Cierra la sesión del usuario revocando la sesión activa y los refresh tokens asociados.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente.
 *       401:
 *         description: Token JWT ausente, inválido o expirado.
 *
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener perfil del usuario autenticado
 *     description: Retorna la información y perfil del usuario actual.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil obtenidos correctamente.
 *       401:
 *         description: Token ausente o inválido.
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
 *       429:
 *         description: Demasiadas solicitudes. Intente más tarde.
 *
 * /auth/totp/verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verificar y activar TOTP
 *     description: |
 *       Valida el código TOTP de 6 dígitos e ingresado por primera vez y activa el 2FA.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: |
 *           TOTP verificado y habilitado. Retorna los códigos de respaldo.
 *       400:
 *         description: |
 *           TOTP no configurado o formato de código inválido.
 *       401:
 *         description: |
 *           Código TOTP inválido o expirado.
 *       429:
 *         description: Demasiadas solicitudes de verificación.
 *
 * /auth/totp/login-verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Completar login con TOTP o Código de Respaldo
 *     description: |
 *       Intercambia el `tempToken` (propósito TOTP_PENDING) y el código TOTP (o de respaldo) por el JWT definitivo.
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
 *         description: |
 *           Verificación TOTP completada. Sesión iniciada.
 *       400:
 *         description: |
 *           Código TOTP o de respaldo inválido o 2FA no habilitado.
 *       401:
 *         description: |
 *           Código inválido o token temporal expirado/ausente.
 *       403:
 *         description: |
 *           Se requiere una sesión temporal de verificación TOTP. Código: TOTP_SESSION_REQUIRED.
 *       429:
 *         description: Demasiados intentos fallidos. Intente más tarde.
 *
 * /auth/totp/disable:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Deshabilitar TOTP
 *     description: |
 *       Desactiva la autenticación en dos pasos mediante la confirmación obligatoria de la contraseña del usuario.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 example: "Password123!"
 *     responses:
 *       200:
 *         description: |
 *           TOTP deshabilitado exitosamente. Se eliminan secretos y códigos de respaldo.
 *       400:
 *         description: |
 *           El usuario no tiene TOTP activado o la contraseña es incorrecta.
 *       401:
 *         description: |
 *           No autenticado o credenciales de confirmación inválidas.
 *       429:
 *         description: Demasiadas solicitudes. Intente más tarde.
 *
 * /auth/password/forgot:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Solicitar restablecimiento de contraseña
 *     description: Envía un correo con el token para cambiar la contraseña.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "johndoe@universidad.edu"
 *     responses:
 *       200:
 *         description: Solicitud recibida. Si el email existe, se enviará el enlace.
 *       429:
 *         description: Demasiadas solicitudes de restablecimiento.
 *
 * /auth/password/reset:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Restablecer contraseña
 *     description: Actualiza la contraseña utilizando un token válido.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "reset-token-xyz"
 *               newPassword:
 *                 type: string
 *                 example: "NewPassword123!"
 *     responses:
 *       200:
 *         description: Contraseña restablecida con éxito.
 *       400:
 *         description: Token inválido o expirado.
 *       429:
 *         description: Demasiadas solicitudes.
 *
 * /auth/verify-email:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verificar dirección de correo
 *     description: Activa el correo electrónico mediante el token enviado tras el registro.
 *     security: []
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
 *                 example: "verify-token-abc"
 *     responses:
 *       200:
 *         description: Correo verificado exitosamente.
 *       400:
 *         description: Token inválido o expirado.
 *       429:
 *         description: Demasiadas solicitudes.
 */