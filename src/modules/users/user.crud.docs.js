/**
 * @file user.crud.docs.js
 * Endpoints OpenAPI: GET/POST/PUT /users y /users/{id}.
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Lista todos los usuarios con filtros y paginación
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, SUPERADMIN, JURY]
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserListResponse' }
 *   post:
 *     summary: Crea un nuevo usuario
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateUserRequest' }
 *     responses:
 *       201: { description: Usuario creado }
 *
 * /api/users/bulk-excel:
 *   post:
 *     summary: Importa usuarios (STUDENT/TEACHER/JURY) desde un archivo .xlsx
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [organization_id, file]
 *             properties:
 *               organization_id: { type: string, format: uuid }
 *               site_id: { type: string, format: uuid }
 *               default_role:
 *                 type: string
 *                 enum: [STUDENT, TEACHER, JURY]
 *                 description: |
 *                   Seleccion de destino. Se aplica solo a filas sin columna role.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Plantilla .xlsx con columnas username, email, password,
 *                   first_name, last_name, role, institutional_id,
 *                   document_type, document_number, current_cycle.
 *     responses:
 *       201: { description: Resumen del lote (created, errors, temp_passwords) }
 *       400: { description: Excel invalido o filas sin datos }
 *
 * /api/users/{id}:
 *   get:
 *     summary: Obtiene un usuario por ID
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Usuario encontrado }
 *       404: { description: Usuario no encontrado }
 *   put:
 *     summary: Actualiza un usuario por ID
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateUserRequest' }
 *     responses:
 *       200: { description: Usuario actualizado }
 */
