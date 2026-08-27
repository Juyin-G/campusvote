// src/modules/organizations/organization-request/organization-request.docs.js

/**
 * @swagger
 * tags:
 *   - name: Organization Requests
 *     description: Gestión de solicitudes de registro de nuevas organizaciones (Lead Generation y Aprobación)
 */

/**
 * @swagger
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
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filtrar solicitudes por estado
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationRequest'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *
 *   post:
 *     summary: Crear solicitud de organización (Público - Lead Generation)
 *     tags: [Organization Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrganizationRequestCreate'
 *     responses:
 *       201:
 *         description: Solicitud de registro creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Solicitud creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/OrganizationRequest'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Conflicto (ej. correo ya registrado)
 */

/**
 * @swagger
 * /api/organizations/requests/{id}/approve:
 *   patch:
 *     summary: Aprobar solicitud de organización (Solo ADMIN)
 *     description: Aprueba la solicitud y crea automáticamente la organización usando una función SQL nativa con bloqueo pesimista.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Solicitud aprobada y organización creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: La solicitud ya fue procesada previamente o datos inválidos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto al crear la organización (ej. código ya registrado)
 */

/**
 * @swagger
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Solicitud rechazada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/OrganizationRequest'
 *       400:
 *         description: El motivo de rechazo es inválido o la solicitud ya fue procesada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrganizationRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         institution_name:
 *           type: string
 *         institution_type:
 *           type: string
 *           enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *         country:
 *           type: string
 *         estimated_members:
 *           type: integer
 *         contact_email:
 *           type: string
 *           format: email
 *         contact_phone:
 *           type: string
 *           nullable: true
 *         message:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         reviewed_by:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     OrganizationRequestCreate:
 *       type: object
 *       required:
 *         - institution_name
 *         - institution_type
 *         - country
 *         - estimated_members
 *         - contact_email
 *       properties:
 *         institution_name:
 *           type: string
 *           maxLength: 200
 *           example: "Universidad Nacional de Ingeniería"
 *         institution_type:
 *           type: string
 *           enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *           example: "UNIVERSITY"
 *         country:
 *           type: string
 *           maxLength: 100
 *           example: "Perú"
 *         estimated_members:
 *           type: integer
 *           minimum: 1
 *           example: 5000
 *         contact_email:
 *           type: string
 *           format: email
 *           example: "decano@uni.edu.pe"
 *         contact_phone:
 *           type: string
 *           maxLength: 20
 *           example: "+51 999 888 777"
 *         message:
 *           type: string
 *           maxLength: 1000
 *           example: "Estamos interesados en implementar el sistema de votación."
 */