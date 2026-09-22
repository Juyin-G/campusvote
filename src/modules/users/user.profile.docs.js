/**
 * @file user.profile.docs.js
 * Endpoints OpenAPI: /users/me, /users/me/password, /users/{id}/role|status|unlock.
 */

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Perfil del usuario }
 *   put:
 *     summary: Actualiza el perfil del usuario autenticado
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateUserRequest' }
 *     responses:
 *       200: { description: Perfil actualizado }
 *
 * /api/users/me/password:
 *   post:
 *     summary: Cambia la contraseña del usuario autenticado
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChangePasswordRequest' }
 *     responses:
 *       200: { description: Contraseña cambiada }
 *
 * /api/users/{id}/role:
 *   patch:
 *     summary: Cambia el rol de un usuario
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
 *           schema: { $ref: '#/components/schemas/ChangeRoleRequest' }
 *     responses:
 *       200: { description: Rol actualizado }
 *
 * /api/users/{id}/status:
 *   patch:
 *     summary: Activa o desactiva un usuario
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
 *           schema: { $ref: '#/components/schemas/SetActiveRequest' }
 *     responses:
 *       200: { description: Estado actualizado }
 *
 * /api/users/{id}/unlock:
 *   patch:
 *     summary: Desbloquea un usuario bloqueado por intentos fallidos
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Usuario desbloqueado }
 */
