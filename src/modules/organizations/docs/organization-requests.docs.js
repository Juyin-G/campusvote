/**
 * @openapi
 * /api/organizations/requests:
 *   get:
 *     summary: Obtener solicitudes de organización (Solo ADMIN)
 *     tags: [Organization Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/OrganizationRequestStatus'
 *         description: Filtrar solicitudes por estado (PENDING, APPROVED, REJECTED)
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
 *     responses:
 *       200:
 *         description: Lista paginada de solicitudes obtenida exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   post:
 *     summary: Crear solicitud de organización (Público - Lead Generation)
 *     tags: [Organization Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequestRequest'
 *     responses:
 *       201:
 *         description: Solicitud de registro creada exitosamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/organizations/requests/{id}/approve:
 *   patch:
 *     summary: Aprobar solicitud de organización (Solo ADMIN)
 *     tags: [Organization Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la solicitud de organización
 *     responses:
 *       200:
 *         description: Solicitud aprobada y organización creada exitosamente
 *       400:
 *         description: La solicitud ya fue procesada previamente o datos inválidos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto al crear la organización (ej. código o correo ya registrado)
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/organizations/requests/{id}/reject:
 *   patch:
 *     summary: Rechazar solicitud de organización (Solo ADMIN)
 *     tags: [Organization Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la solicitud de organización
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejection_reason
 *             properties:
 *               rejection_reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "La información proporcionada no pudo ser verificada."
 *     responses:
 *       200:
 *         description: Solicitud rechazada exitosamente
 *       400:
 *         description: El motivo de rechazo es inválido o la solicitud ya fue procesada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */