// src/modules/elections/candidacy/candidacy.schemas.docs.js
// OpenAPI: schemas del módulo candidacy.

/**
 * @openapi
 * components:
 *   schemas:
 *     Candidacy:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         election_id: { type: string, format: uuid }
 *         candidate_list_id: { type: string, format: uuid }
 *         position_id: { type: string, format: uuid, nullable: true }
 *         user_id: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         order_index: { type: integer }
 *         is_principal: { type: boolean }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         user:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             username: { type: string }
 *             first_name: { type: string }
 *             last_name: { type: string }
 *             institutional_id: { type: string }
 *
 *     CreateCandidacyRequest:
 *       type: object
 *       required: [candidate_list_id, user_id]
 *       properties:
 *         candidate_list_id: { type: string, format: uuid }
 *         position_id: { type: string, format: uuid }
 *         user_id: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         is_principal: { type: boolean }
 *         order_index: { type: integer }
 */
