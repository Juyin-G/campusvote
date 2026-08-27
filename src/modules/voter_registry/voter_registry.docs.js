// src/modules/voter_registry/voter_registry.docs.js

/**
 * @swagger
 * tags:
 *   name: Voter Registry
 *   description: Gestión del padrón electoral y reclamos de inscripción
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VoterClaimType:
 *       type: string
 *       enum: [MISSING_FROM_REGISTRY, INCORRECT_DATA, INELIGIBLE_MARKED_ELIGIBLE]
 *       example: MISSING_FROM_REGISTRY
 *
 *     VoterClaimStatus:
 *       type: string
 *       enum: [PENDING, APPROVED, REJECTED]
 *       example: PENDING
 *
 *     VoterRegistryClaimResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *         userId:
 *           type: string
 *           format: uuid
 *         periodId:
 *           type: string
 *           format: uuid
 *         claimType:
 *           $ref: '#/components/schemas/VoterClaimType'
 *         description:
 *           type: string
 *           example: "No aparezco registrado en el padrón del periodo actual a pesar de estar matriculado."
 *         supportingDocumentUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://storage.example.com/docs/constancia-matricula.pdf"
 *         status:
 *           $ref: '#/components/schemas/VoterClaimStatus'
 *         reviewedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         resolutionNotes:
 *           type: string
 *           nullable: true
 *           example: "Se verificó la matrícula y se incluyó en el padrón."
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     CreateVoterClaimInput:
 *       type: object
 *       required:
 *         - periodId
 *         - claimType
 *         - description
 *       properties:
 *         periodId:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *         claimType:
 *           $ref: '#/components/schemas/VoterClaimType'
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 2000
 *           example: "Solicito inclusión en el padrón tras regularizar mi matrícula."
 *         supportingDocumentUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://storage.example.com/docs/evidencia.pdf"
 *
 *     ResolveVoterClaimInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [APPROVED, REJECTED]
 *           example: APPROVED
 *         resolutionNotes:
 *           type: string
 *           maxLength: 1000
 *           nullable: true
 *           example: "Reclamo procedente. Se actualizó la elegibilidad en el padrón."
 */

/**
 * @swagger
 * /api/v1/voter-registry/claims:
 *   post:
 *     summary: Crear un reclamo de padrón electoral
 *     tags: [Voter Registry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateVoterClaimInput'
 *     responses:
 *       201:
 *         description: Reclamo registrado exitosamente.
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
 *                   example: "Reclamo registrado exitosamente."
 *                 data:
 *                   $ref: '#/components/schemas/VoterRegistryClaimResponse'
 *       400:
 *         description: Error de validación en los datos ingresados.
 *       409:
 *         description: Ya existe un reclamo PENDING activo para el usuario en este periodo.
 *
 *   get:
 *     summary: Obtener listado paginado de reclamos (Admin/Comisión)
 *     tags: [Voter Registry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por UUID del periodo académico.
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/VoterClaimStatus'
 *         description: Filtrar por estado del reclamo.
 *       - in: query
 *         name: claimType
 *         schema:
 *           $ref: '#/components/schemas/VoterClaimType'
 *         description: Filtrar por tipo de reclamo.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad de elementos por página.
 *     responses:
 *       200:
 *         description: Listado de reclamos obtenido exitosamente.
 *       403:
 *         description: Acceso denegado (Requiere roles ADMIN o ELECTORAL_COMMISSION).
 */

/**
 * @swagger
 * /api/v1/voter-registry/status:
 *   get:
 *     summary: Consultar estado en el padrón del usuario autenticado
 *     tags: [Voter Registry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del periodo académico a consultar.
 *     responses:
 *       200:
 *         description: Estado devuelto correctamente.
 *       401:
 *         description: No autenticado.
 */

/**
 * @swagger
 * /api/v1/voter-registry/claims/{claimId}/resolve:
 *   patch:
 *     summary: Resolver un reclamo de padrón (Admin/Comisión)
 *     description: Invoca la función PL/pgSQL `resolve_voter_registry_claim` para resolver el reclamo y actualizar el padrón si es APROBADO.
 *     tags: [Voter Registry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del reclamo a resolver.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResolveVoterClaimInput'
 *     responses:
 *       200:
 *         description: Reclamo resuelto exitosamente.
 *       400:
 *         description: Error en los parámetros o reclamo ya resuelto / estado inválido.
 *       403:
 *         description: Acceso denegado.
 *       404:
 *         description: Reclamo no encontrado.
 */