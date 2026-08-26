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
 *               backupCode:
 *                 type: string
 *                 example: "ABC123XYZ"
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
 *
 * /auth/verify-email/resend:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reenviar el correo de verificación
 *     description: >
 *       Genera un nuevo enlace de verificación para una cuenta pendiente.
 *       Es la salida para quien se registró y no recibió el correo.
 *       Responde siempre 200 con el mismo mensaje —exista la cuenta, esté ya
 *       verificada o falle el envío— para no revelar qué correos están
 *       registrados.
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
 *                 format: email
 *                 example: "estudiante@campusvote.edu.pe"
 *     responses:
 *       200:
 *         description: Solicitud procesada (respuesta genérica).
 *       400:
 *         description: El correo enviado no tiene formato válido.
 *       429:
 *         description: Demasiadas solicitudes.
 */