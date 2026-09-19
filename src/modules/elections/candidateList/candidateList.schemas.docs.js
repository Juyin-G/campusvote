// src/modules/elections/candidateList/candidateList.schemas.docs.js
// OpenAPI: schemas del módulo candidateList.

/**
 * @openapi
 * components:
 *   schemas:
 *     CandidateList:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         election_id: { type: string, format: uuid }
 *         name: { type: string, description: Nombre de la lista }
 *         acronym: { type: string, nullable: true }
 *         motto: { type: string, nullable: true }
 *         logo: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         imageUrl: { type: string, nullable: true }
 *         category: { type: string, nullable: true }
 *         tags:
 *           type: array
 *           items: { type: string }
 *         ratings:
 *           type: object
 *           nullable: true
 *           description: Resumen (solo con withRatings=true)
 *           properties:
 *             count: { type: integer }
 *             average: { type: number }
 *         latestComment: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *
 *     CreateCandidateListRequest:
 *       type: object
 *       required: [name]
 *       properties:
 *         name: { type: string, maxLength: 255 }
 *         acronym: { type: string, maxLength: 20 }
 *         motto: { type: string, maxLength: 500 }
 *         logo: { type: string, format: uri }
 *         description: { type: string, maxLength: 5000 }
 *         imageUrl: { type: string, format: uri }
 *         category: { type: string }
 *         tags:
 *           type: array
 *           items: { type: string }
 */
