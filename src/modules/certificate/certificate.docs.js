/**
 * @file certificate.docs.js
 * @description Documentación OpenAPI (Swagger) del módulo de certificados
 *   oficiales de ferias académicas.
 * @openapi
 * components:
 *   schemas:
 *     Certificate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Identificador único del certificado (NO usa DNI).
 *         user_id:
 *           type: string
 *           format: uuid
 *         project_id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         certificate_type:
 *           type: string
 *           enum: [PARTICIPATION, WINNER]
 *         issue_date:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           nullable: true
 *         valid_until:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fair:
 *           type: object
 *           properties:
 *             id:    { type: string, format: uuid }
 *             name:  { type: string }
 *             organization_id: { type: string, format: uuid }
 *             status:
 *               type: string
 *               enum: [DRAFT, OPEN, CLOSED]
 *         project:
 *           type: object
 *           properties:
 *             id:     { type: string, format: uuid }
 *             name:   { type: string }
 *             status:
 *               type: string
 *               enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *         participant:
 *           type: object
 *           properties:
 *             id:         { type: string, format: uuid }
 *             first_name: { type: string }
 *             last_name:  { type: string }
 *
 *     CertificateGenerationResult:
 *       type: object
 *       properties:
 *         fair_id:
 *           type: string
 *           format: uuid
 *         summary:
 *           type: object
 *           properties:
 *             participation: { type: integer }
 *             winner:         { type: integer }
 *             total:          { type: integer }
 *         certificates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               certificate_id:   { type: string, format: uuid }
 *               user_id:          { type: string, format: uuid }
 *               project_id:       { type: string, format: uuid }
 *               fair_id:          { type: string, format: uuid }
 *               certificate_type:
 *                 type: string
 *                 enum: [PARTICIPATION, WINNER]
 *               created: { type: boolean }
 */

/**
 * @openapi
 * /api/fairs/{id}/certificates/generate:
 *   post:
 *     tags: [Certificates]
 *     summary: Generar certificados oficiales de una feria (ADMIN de la organización)
 *     description: >
 *       Genera los certificados de PARTICIPATION (todos los miembros de cada
 *       proyecto APPROVED) y WINNER (miembros del proyecto con position === 1
 *       según getFairResults()). Solo se permite si la feria está CLOSED y
 *       tiene publicación oficial. Idempotente. El cuerpo del cliente se
 *       IGNORA (no se envía fair_id/project_id/user_id/certificate_type).
 *       SUPERADMIN NO tiene bypass operativo: solo el ADMIN de la
 *       organización de la feria puede generar.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Certificados generados (o existentes, idempotente)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CertificateGenerationResult'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         description: La feria no está CLOSED o no tiene publicación oficial
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *
 * /api/certificates/my:
 *   get:
 *     tags: [Certificates]
 *     summary: Certificados del participante autenticado
 *     description: >
 *       Devuelve únicamente los certificados emitidos al usuario autenticado.
 *       Ningún rol (ADMIN, JURY, SUPERADMIN) puede usar este endpoint para
 *       inspeccionar certificados de terceros.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de certificados del participante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id: { type: string, format: uuid }
 *                 certificates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Certificate'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *
 * /api/certificates/{certificateId}:
 *   get:
 *     tags: [Certificates]
 *     summary: Consulta individual de un certificado
 *     description: >
 *       Participante: solo su propio certificado. ADMIN de la organización:
 *       certificados de su organización. JURY/STUDENT/TEACHER sin
 *       participación: 403. SUPERADMIN: sin bypass operativo (debe ser dueño
 *       o ADMIN de la org). Los certificados son inmutables (no hay
 *       PUT/PATCH/DELETE).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Certificado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Certificate'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *
 * /api/certificates/{certificateId}/pdf:
 *   get:
 *     tags: [Certificates]
 *     summary: Descargar PDF del certificado (mismas reglas de autorización)
 *     description: >
 *       Devuelve un PDF determinista con los datos oficiales del
 *       certificado: nombre de la feria, nombre del proyecto, nombre del
 *       participante, tipo de certificado, fecha de emisión e identificador
 *       único. NO incluye DNI ni información sensible innecesaria. Para
 *       WINNER indica que corresponde al ganador general.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF generado (application/pdf)
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 */