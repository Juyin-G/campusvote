/**
 * @file fairResult.docs.js
 * @description Documentación OpenAPI (Swagger) de resultados de proyectos de
 *   ferias académicas (dominio de FERIAS; ajeno al dominio electoral).
 * @openapi
 * components:
 *   schemas:
 *     FairRankingEntry:
 *       type: object
 *       properties:
 *         position:
 *           type: integer
 *           nullable: true
 *           description: >
 *             Posición en el ranking. null para proyectos APPROVED sin
 *             evaluaciones (nunca reciben posición de ganador).
 *         project_id:
 *           type: string
 *           format: uuid
 *         project_name:
 *           type: string
 *         average_score:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: >
 *             Promedio de los total_score de las evaluaciones (redondeado a
 *             2 decimales). null si el proyecto no tiene evaluaciones (no se
 *             inventa un 0).
 *         evaluation_count:
 *           type: integer
 *         winner:
 *           type: boolean
 *           description: >
 *             true SOLO para position 1 de una feria CLOSED con resultados
 *             publicados (published=true). En DRAFT/OPEN, o CLOSED sin
 *             publicar, siempre false (no existe ganador definitivo).
 *     FairResultPublication:
 *       type: object
 *       properties:
 *         fair_id:
 *           type: string
 *           format: uuid
 *         fair_name:
 *           type: string
 *         fair_status:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *         published:
 *           type: boolean
 *           description: true si los resultados ya fueron publicados oficialmente
 *         published_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Cuándo se publicó (null si aún no se publicó)
 *         published_by:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *           description: Quién publicó (null si aún no se publicó)
 *     FairResults:
 *       type: object
 *       properties:
 *         fair_id:
 *           type: string
 *           format: uuid
 *         fair_name:
 *           type: string
 *         fair_status:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *         published:
 *           type: boolean
 *         published_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         published_by:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *         ranking:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FairRankingEntry'
 */

/**
 * @openapi
 * /api/fairs/{id}/results:
 *   get:
 *     tags: [Fair Results]
 *     summary: Ranking/resultados de proyectos de una feria (ADMIN/SUPERADMIN)
 *     description: >
 *       Ranking determinista derivado de las evaluaciones en BD (nunca de datos
 *       del cliente): promedio DESC, cantidad de evaluaciones DESC y, si el
 *       empate persiste, project.id ASC. El ganador (winner=true) SOLO existe
 *       con fair.status=CLOSED, resultados publicados (published=true) y
 *       position=1. Incluye publicado/cuándo/quién. ADMIN solo consulta
 *       ferias de su organización; SUPERADMIN mantiene el bypass de tenant
 *       existente. JURY/STUDENT/TEACHER/ELECTORAL_COMMISSION no tienen acceso.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ranking de la feria (proyectos APPROVED, evaluados y sin evaluaciones)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairResults'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/results/publish:
 *   post:
 *     tags: [Fair Results]
 *     summary: Publicar oficialmente los resultados de una feria (ADMIN/SUPERADMIN)
 *     description: >
 *       Persistencia MÍNIMA del evento de publicación (fair_result_publications):
 *       máximo UNA publicación por feria. El ranking/ganador/promedio NO se
 *       envían ni se persisten: el backend vuelve a derivarlos de las
 *       evaluaciones. Solo permite publicar una feria cerrada (CLOSED); si ya
 *       fue publicada responde 409 (no crea duplicados). ADMIN solo publica
 *       ferias de su organización; SUPERADMIN conserva el bypass de tenant.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Resultados publicados (fair, published=true, published_at y published_by)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairResultPublication'
 *       409:
 *         description: La feria no está CLOSED o ya fue publicada
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 */