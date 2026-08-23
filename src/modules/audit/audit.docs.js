/**
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: "Mensaje descriptivo del error"
 *             details:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["El parámetro electionId es requerido"]
 *
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *         actorId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *         electionId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "b1febc99-9c0b-4ef8-bb6d-6bb9bd380a22"
 *         action:
 *           type: string
 *           enum: [LOGIN, VERIFY_2FA, CREATE_ELECTION, OPEN_ELECTION, CAST_VOTE, CLOSE_ELECTION, CERTIFY_RESULT, PUBLISH_RESULT]
 *           example: "CAST_VOTE"
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           example: "192.168.1.1"
 *         metadata:
 *           type: object
 *           example: { "browser": "Chrome", "os": "Windows" }
 *         previousHash:
 *           type: string
 *           example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *         currentHash:
 *           type: string
 *           example: "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"
 *         signature:
 *           type: string
 *           example: "a8f5f167f44f4964e6c998dee827110c"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-08-23T10:00:00.000Z"
 */

/**
 * @openapi
 * /audit/logs:
 *   get:
 *     tags:
 *       - Audit Logs
 *     summary: Consultar registros de auditoría
 *     description: Obtiene una lista paginada de logs de auditoría con filtros opcionales. Requiere rol admin o auditor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *           enum: [LOGIN, VERIFY_2FA, CREATE_ELECTION, OPEN_ELECTION, CAST_VOTE, CLOSE_ELECTION, CERTIFY_RESULT, PUBLISH_RESULT]
 *       - name: electionId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: actorId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: fromDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: toDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista de logs recuperada exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Acceso denegado (Requiere rol admin o auditor)
 *       500:
 *         description: Error interno del servidor
 *
 *   post:
 *     tags:
 *       - Audit Logs
 *     summary: Registrar una nueva acción de auditoría
 *     description: Crea un nuevo registro inmutable en la tabla de auditoría. Endpoint de uso interno o administrativo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [LOGIN, VERIFY_2FA, CREATE_ELECTION, OPEN_ELECTION, CAST_VOTE, CLOSE_ELECTION, CERTIFY_RESULT, PUBLISH_RESULT]
 *               electionId:
 *                 type: string
 *                 format: uuid
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Registro de auditoría creado exitosamente
 *       400:
 *         description: Datos inválidos o acción no permitida
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /audit/logs/{id}:
 *   get:
 *     tags:
 *       - Audit Logs
 *     summary: Obtener un registro de auditoría específico
 *     description: Obtiene un log por su ID UUID. Requiere rol admin o auditor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Registro encontrado
 *       400:
 *         description: ID de auditoría inválido
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Registro no encontrado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /audit/tokens:
 *   post:
 *     tags:
 *       - One-Time Tokens
 *     summary: Crear un token de un solo uso
 *     description: Genera un token seguro. El token en texto plano solo se retorna una única vez.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - electionId
 *               - expiresAt
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               electionId:
 *                 type: string
 *                 format: uuid
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Token creado exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Permisos insuficientes para crear token para otro usuario
 *       409:
 *         description: Ya existe un token activo para este usuario y elección
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /audit/tokens/consume:
 *   post:
 *     tags:
 *       - One-Time Tokens
 *     summary: Consumir un token de un solo uso
 *     description: Valida y consume el token de forma atómica. Endpoint público protegido por Rate Limiting.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rawToken
 *               - electionId
 *             properties:
 *               rawToken:
 *                 type: string
 *                 description: El token en texto plano
 *               electionId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Token consumido exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 *       404:
 *         description: Token inválido o no pertenece a esta elección
 *       409:
 *         description: El token ya ha sido utilizado
 *       410:
 *         description: El token ha expirado
 *       429:
 *         description: Demasiadas solicitudes. Límite de tasa alcanzado.
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /audit/tokens/status:
 *   get:
 *     tags:
 *       - One-Time Tokens
 *     summary: Verificar el estado de un token
 *     description: Consulta el estado de un token sin consumirlo (ACTIVE, USED, EXPIRED, NOT_FOUND). Endpoint público protegido por Rate Limiting.
 *     parameters:
 *       - name: token
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: electionId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Estado del token obtenido
 *       400:
 *         description: Parámetros de consulta faltantes o inválidos
 *       429:
 *         description: Demasiadas solicitudes. Límite de tasa alcanzado.
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /audit/tokens/cleanup:
 *   delete:
 *     tags:
 *       - One-Time Tokens
 *     summary: Limpiar tokens expirados
 *     description: Elimina registros de tokens expirados. Requiere permisos de administrador.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Limpieza completada
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Acceso denegado (Requiere rol admin)
 *       500:
 *         description: Error interno del servidor
 */