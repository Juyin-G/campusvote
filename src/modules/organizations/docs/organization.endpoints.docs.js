/**
 * @openapi
 * tags:
 *   name: Organizations
 *   description: Gestión de organizaciones (tenants)
 */

/**
 * @openapi
 * /api/organizations:
 *   get:
 *     summary: Obtener lista paginada de organizaciones
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda por nombre o código
 *       - in: query
 *         name: org_type
 *         schema:
 *           $ref: '#/components/schemas/OrganizationType'
 *         description: Filtrar por tipo de organización
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado de activación
 *       - in: query
 *         name: onboarding_completed
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado de onboarding
 *     responses:
 *       200:
 *         description: Lista de organizaciones obtenida exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   post:
 *     summary: Crear una nueva organización (Solo ADMIN)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequest'
 *     responses:
 *       201:
 *         description: Organización creada exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Ya existe una organización registrada con ese código
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/organizations/{id}:
 *   get:
 *     summary: Obtener organización por ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la organización
 *     responses:
 *       200:
 *         description: Organización encontrada
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   put:
 *     summary: Actualizar organización por ID (ADMIN u ORG_ADMIN)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la organización
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrganizationRequest'
 *     responses:
 *       200:
 *         description: Organización actualizada exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: El nuevo código de la organización ya está en uso por otra entidad
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   delete:
 *     summary: Eliminar organización por ID (Solo ADMIN)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la organización
 *     responses:
 *       200:
 *         description: Organización eliminada exitosamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/organizations/{id}/onboarding:
 *   patch:
 *     summary: Actualizar datos de onboarding de una organización (ADMIN u ORG_ADMIN)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la organización
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Universidad Nacional Mayor de San Marcos"
 *               logo:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: "https://storage.googleapis.com/bucket/logo.png"
 *               primary_color:
 *                 type: string
 *                 example: "#0066CC"
 *               secondary_color:
 *                 type: string
 *                 example: "#FFD700"
 *               country:
 *                 type: string
 *                 example: "Perú"
 *               timezone:
 *                 type: string
 *                 example: "America/Lima"
 *     responses:
 *       200:
 *         description: Datos de onboarding actualizados exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/organizations/{id}/onboarding/complete:
 *   post:
 *     summary: Marcar el onboarding de una organización como completado (ADMIN u ORG_ADMIN)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la organización
 *     responses:
 *       200:
 *         description: Onboarding completado exitosamente
 *       400:
 *         description: El onboarding de esta organización ya fue completado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */