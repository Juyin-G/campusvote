/**
 * S4-12 — Documentación Swagger del recurso principal de elecciones.
 * Este archivo solo contiene anotaciones @openapi; no exporta código.
 *
 * @openapi
 * components:
 *   schemas:
 *     ElectionStatus:
 *       type: string
 *       enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *       description: >
 *         Estado dentro del workflow. Las transiciones son estrictamente
 *         lineales: DRAFT → SCHEDULED → OPEN → CLOSED → CERTIFIED → PUBLISHED.
 *     ElectionScope:
 *       type: string
 *       enum: [UNIVERSITY, FACULTY, PROGRAM]
 *     ElectionProcess:
 *       type: string
 *       enum: [VOTE, FAIR, FEEDBACK, FORM]
 *     Election:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string, maxLength: 255 }
 *         description: { type: string }
 *         process_type: { $ref: '#/components/schemas/ElectionProcess' }
 *         election_type: { $ref: '#/components/schemas/ElectionScope' }
 *         period_id: { type: string, format: uuid }
 *         faculty_id: { type: string, format: uuid, nullable: true }
 *         program_id: { type: string, format: uuid, nullable: true }
 *         start_at: { type: string, format: date-time }
 *         end_at: { type: string, format: date-time }
 *         status: { $ref: '#/components/schemas/ElectionStatus' }
 *         created_by: { type: string, format: uuid }
 *         is_anonymous_allowed: { type: boolean }
 */

/**
 * @openapi
 * /api/elections:
 *   get:
 *     summary: Listar elecciones paginadas
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 100 } }
 *       - { in: query, name: status, schema: { $ref: '#/components/schemas/ElectionStatus' } }
 *       - { in: query, name: election_type, schema: { $ref: '#/components/schemas/ElectionScope' } }
 *       - { in: query, name: period_id, schema: { type: string, format: uuid } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 } }
 *     responses:
 *       200: { description: Lista paginada de elecciones }
 *       401: { description: Token no provisto o inválido }
 *
 *   post:
 *     summary: Crear una elección (nace en estado DRAFT)
 *     description: >
 *       El alcance debe ser coherente: UNIVERSITY sin facultad ni programa,
 *       FACULTY con faculty_id, PROGRAM con faculty_id y program_id.
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, election_type, period_id, start_at, end_at]
 *             properties:
 *               title: { type: string, example: Elecciones Generales 2026 }
 *               description: { type: string }
 *               process_type: { $ref: '#/components/schemas/ElectionProcess' }
 *               election_type: { $ref: '#/components/schemas/ElectionScope' }
 *               period_id: { type: string, format: uuid }
 *               faculty_id: { type: string, format: uuid, nullable: true }
 *               program_id: { type: string, format: uuid, nullable: true }
 *               start_at: { type: string, format: date-time }
 *               end_at: { type: string, format: date-time }
 *               is_anonymous_allowed: { type: boolean, default: false }
 *     responses:
 *       201: { description: Elección creada }
 *       400: { description: Alcance incoherente, fechas inválidas o período inexistente }
 *       403: { description: Requiere rol ADMIN o ELECTORAL_COMMISSION }
 */

/**
 * @openapi
 * /api/elections/{id}:
 *   get:
 *     summary: Obtener una elección por ID
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Elección encontrada }
 *       404: { description: La elección no existe }
 *
 *   put:
 *     summary: Actualizar una elección
 *     description: Solo se permite mientras la elección esté en estado DRAFT.
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               start_at: { type: string, format: date-time }
 *               end_at: { type: string, format: date-time }
 *     responses:
 *       200: { description: Elección actualizada }
 *       409: { description: La elección ya no está en DRAFT }
 *
 *   delete:
 *     summary: Eliminar una elección
 *     description: Solo en estado DRAFT y reservado a ADMIN por ser irreversible.
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Elección eliminada }
 *       403: { description: Requiere rol ADMIN }
 *       409: { description: La elección ya no está en DRAFT }
 */

/**
 * @openapi
 * /api/elections/{id}/status:
 *   patch:
 *     summary: Avanzar la elección en el workflow de estados
 *     description: >
 *       Solo se admiten transiciones lineales. Requisitos adicionales:
 *       para pasar a SCHEDULED la elección debe tener al menos un cargo
 *       definido y su fecha de fin no puede haber vencido. El paso
 *       CLOSED → CERTIFIED se delega a la función SQL certify_election().
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { $ref: '#/components/schemas/ElectionStatus' }
 *     responses:
 *       200: { description: Estado actualizado }
 *       400: { description: No cumple los requisitos para entrar a ese estado }
 *       404: { description: La elección no existe }
 *       409: { description: Transición no permitida desde el estado actual }
 */
