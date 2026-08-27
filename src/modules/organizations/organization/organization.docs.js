// src/modules/organizations/organization/organization.docs.js

/*
 * @swagger
 * tags:
 *   - name: Organizations
 *     description: Gestión de organizaciones (tenants) y su proceso de onboarding
 *   - name: Organization Requests
 *     description: Gestión de solicitudes de registro de nuevas organizaciones (Lead Generation)
 */

//ORGANIZATION REQUESTS (Solicitudes / Leads)

/**
 * @swagger
 * /api/organizations/requests:
 *   get:
 *     summary: Listar solicitudes de organización
 *     description: "Obtiene una lista paginada de solicitudes de registro de organizaciones. Solo para administradores."
 *     tags: [Organization Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Lista de solicitudes obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationRequest'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido (Se requiere rol ADMIN)
 *
 *   post:
 *     summary: Crear una nueva solicitud de organización
 *     description: "Envía una solicitud para registrar una nueva organización en la plataforma. Endpoint público."
 *     tags: [Organization Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - institution_name
 *               - institution_type
 *               - country
 *               - estimated_members
 *               - contact_email
 *             properties:
 *               institution_name:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Universidad Nacional de Ingeniería"
 *               institution_type:
 *                 type: string
 *                 enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *                 example: "UNIVERSITY"
 *               country:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Perú"
 *               estimated_members:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5000
 *               contact_email:
 *                 type: string
 *                 format: email
 *                 example: "decano@uni.edu.pe"
 *               contact_phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: "+51 999 888 777"
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Estamos interesados en implementar el sistema de votación."
 *     responses:
 *       201:
 *         description: Solicitud creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Solicitud de organización enviada exitosamente. Nos pondremos en contacto pronto."
 *                 data:
 *                   $ref: '#/components/schemas/OrganizationRequest'
 *       400:
 *         description: Datos de solicitud inválidos
 */

/**
 * @swagger
 * /api/organizations/requests/{id}:
 *   get:
 *     summary: Obtener detalles de una solicitud
 *     description: "Obtiene los detalles completos de una solicitud específica. Solo para administradores."
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
 *     responses:
 *       200:
 *         description: Detalles de la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/OrganizationRequest'
 *       404:
 *         description: Solicitud no encontrada
 *
 *   patch:
 *     summary: Aprobar una solicitud
 *     description: "Aprueba la solicitud y crea automáticamente la organización usando la función SQL nativa."
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
 *     responses:
 *       200:
 *         description: Solicitud aprobada y organización creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Solicitud aprobada y organización creada"
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: La solicitud ya fue procesada o el usuario no tiene permisos
 */

/**
 * @swagger
 * /api/organizations/requests/{id}/reject:
 *   patch:
 *     summary: Rechazar una solicitud
 *     description: "Rechaza una solicitud de organización, registrando el motivo del rechazo."
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
 *                 example: "La institución no cumple con los requisitos mínimos de miembros."
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
 *                   example: "Solicitud rechazada"
 *                 data:
 *                   $ref: '#/components/schemas/OrganizationRequest'
 *       400:
 *         description: Motivo de rechazo requerido
 */

/* ==========================================================================
 * ORGANIZATIONS (CRUD y Onboarding)
 * ========================================================================== */

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: Listar organizaciones
 *     description: "Obtiene una lista paginada de organizaciones registradas en la plataforma."
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "Buscar por nombre, código o país"
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *     responses:
 *       200:
 *         description: Lista de organizaciones obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Organization'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *
 *   post:
 *     summary: Crear una organización manualmente
 *     description: "Crea una nueva organización directamente (sin pasar por solicitud). Solo para administradores."
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Universidad de Lima"
 *               code:
 *                 type: string
 *                 maxLength: 30
 *                 example: "ULIMA"
 *               org_type:
 *                 type: string
 *                 enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *                 default: UNIVERSITY
 *               logo:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/logo.png"
 *               primary_color:
 *                 type: string
 *                 pattern: "^#[0-9a-fA-F]{6}$"
 *                 default: "#0066CC"
 *               secondary_color:
 *                 type: string
 *                 pattern: "^#[0-9a-fA-F]{6}$"
 *                 default: "#FFD700"
 *               country:
 *                 type: string
 *                 default: "Perú"
 *               timezone:
 *                 type: string
 *                 default: "America/Lima"
 *     responses:
 *       201:
 *         description: Organización creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       409:
 *         description: Ya existe una organización con ese código
 */

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Obtener organización por ID
 *     description: "Obtiene los detalles de una organización específica."
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalles de la organización
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organización no encontrada
 *
 *   patch:
 *     summary: Actualizar organización
 *     description: "Actualiza parcialmente los datos de una organización. Solo ADMIN u ORG_ADMIN."
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               code:
 *                 type: string
 *                 maxLength: 30
 *               org_type:
 *                 type: string
 *                 enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *               is_active:
 *                 type: boolean
 *               onboarding_completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Organización actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organización no encontrada
 *
 *   delete:
 *     summary: Eliminar organización
 *     description: "Elimina una organización del sistema. Solo para administradores."
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
 *     responses:
 *       200:
 *         description: Organización eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Organización no encontrada
 */

/**
 * @swagger
 * /api/organizations/{id}/onboarding:
 *   patch:
 *     summary: Actualizar datos de onboarding
 *     description: "Actualiza campos específicos relacionados con el proceso de onboarding (logo, colores, etc.)."
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: uri
 *               primary_color:
 *                 type: string
 *                 pattern: "^#[0-9a-fA-F]{6}$"
 *               secondary_color:
 *                 type: string
 *                 pattern: "^#[0-9a-fA-F]{6}$"
 *               country:
 *                 type: string
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Datos de onboarding actualizados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 */

/**
 * @swagger
 * /api/organizations/{id}/onboarding/complete:
 *   post:
 *     summary: Marcar onboarding como completado
 *     description: "Finaliza el proceso de onboarding, estableciendo la fecha de completado."
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
 *     responses:
 *       200:
 *         description: Onboarding completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: El onboarding ya fue completado previamente
 */

/* ==========================================================================
 * SCHEMAS
 * ========================================================================== */

/**
 * @swagger
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         org_type:
 *           type: string
 *           enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *         is_active:
 *           type: boolean
 *         logo:
 *           type: string
 *           format: uri
 *           nullable: true
 *         primary_color:
 *           type: string
 *           pattern: "^#[0-9a-fA-F]{6}$"
 *         secondary_color:
 *           type: string
 *           pattern: "^#[0-9a-fA-F]{6}$"
 *         country:
 *           type: string
 *         timezone:
 *           type: string
 *         onboarding_completed:
 *           type: boolean
 *         onboarding_completed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
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
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         total:
 *           type: integer
 *         totalPages:
 *           type: integer
 */