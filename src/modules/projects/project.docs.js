/**
 * @file project.docs.js
 * @description Documentación OpenAPI (Swagger) del módulo de proyectos de feria.
 * @openapi
 * components:
 *   schemas:
 *     ProjectMemberProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         first_name:
 *           type: string
 *           nullable: true
 *         last_name:
 *           type: string
 *           nullable: true
 *         institutional_id:
 *           type: string
 *           nullable: true
 *         role:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, SUPERADMIN, JURY]
 *     ProjectMember:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         role:
 *           type: string
 *           enum: [EXPOSITOR, COLLABORATOR, ADVISOR]
 *         created_at:
 *           type: string
 *           format: date-time
 *         user:
 *           $ref: '#/components/schemas/ProjectMemberProfile'
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         organization_id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *           description: Feria a la que pertenece el proyecto (fuente de verdad de la organización)
 *         fair:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *             status:
 *               type: string
 *               enum: [DRAFT, OPEN, CLOSED]
 *         created_by:
 *           $ref: '#/components/schemas/ProjectMemberProfile'
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *         cover_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *         project_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *         review_notes:
 *           type: string
 *           nullable: true
 *         reviewed_by:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         submitted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         members:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectMember'
 *         is_owner:
 *           type: boolean
 */

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: Listar proyectos visibles para el usuario
 *     description: >
 *       El scope se resuelve por organización. No-admin ve sus propios
 *       proyectos y los APPROVED de su organización; ADMIN ve todos los de su
 *       organización. SUPERADMIN NO tiene acceso operativo a proyectos
 *       (403 desde este router; sin bypass aunque tenga organizationId).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Página actual
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Límite por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *         description: Filtrar por estado
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Búsqueda por nombre del proyecto
 *     responses:
 *       200:
 *         description: Lista paginada de proyectos
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Projects]
 *     summary: Crear proyecto (propietario STUDENT/TEACHER)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fair_id, name]
 *             properties:
 *               fair_id:
 *                 type: string
 *                 format: uuid
 *                 description: >
 *                   Feria de la organización del usuario donde se registra el
 *                   proyecto. Debe estar en estado DRAFT u OPEN.
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               logo_url:
 *                 type: string
 *                 format: uri
 *               cover_url:
 *                 type: string
 *                 format: uri
 *               project_url:
 *                 type: string
 *                 format: uri
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Proyecto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Obtener un proyecto con sus integrantes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalle del proyecto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       '404':
 *         $ref: '#/components/responses/NotFoundResponse'
 *   put:
 *     tags: [Projects]
 *     summary: Editar proyecto (solo propietario, en DRAFT o REJECTED)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fair_id:
 *                 type: string
 *                 format: uuid
 *                 description: >
 *                   Nueva feria del proyecto. Debe pertenecer a la misma
 *                   organización (no se permite mover el proyecto entre
 *                   organizaciones) y estar en estado DRAFT u OPEN.
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               logo_url:
 *                 type: string
 *                 format: uri
 *               cover_url:
 *                 type: string
 *                 format: uri
 *               project_url:
 *                 type: string
 *                 format: uri
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Proyecto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *
 * /api/projects/{id}/submit:
 *   post:
 *     tags: [Projects]
 *     summary: Enviar proyecto a revisión (propietario)
 *     description: Transiciona DRAFT -> SUBMITTED.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Proyecto enviado a revisión
 *
 * /api/projects/{id}/review:
 *   post:
 *     tags: [Projects]
 *     summary: Aprobar o rechazar proyecto (ADMIN de la organización dueña)
 *     description: >
 *       ADMIN de la organización dueña del proyecto aprueba o rechaza.
 *       SUPERADMIN NO tiene acceso operativo (403 desde este router; sin
 *       bypass aunque tenga organizationId).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               review_notes:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Obligatorio cuando decision = REJECTED
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Revisión registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       '409':
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/projects/{id}/members:
 *   get:
 *     tags: [Projects]
 *     summary: Listar integrantes del proyecto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Integrantes
 *   post:
 *     tags: [Projects]
 *     summary: Agregar integrante (propietario, en DRAFT o REJECTED)
 *     description: >
 *       El usuario debe pertenecer a la misma organización que el proyecto
 *       (regla de pertenencia).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [EXPOSITOR, COLLABORATOR, ADVISOR]
 *                 default: EXPOSITOR
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Integrante agregado
 *
 * /api/projects/{id}/members/{userId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Quitar integrante (propietario, en DRAFT o REJECTED)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Integrante removido
 *       '404':
 *         $ref: '#/components/responses/NotFoundResponse'
 */