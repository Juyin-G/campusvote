// src/modules/elections/elections/election.schemas.docs.js
// OpenAPI: schemas del módulo de elecciones.

/**
 * @openapi
 * components:
 *   schemas:
 *     Election:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string }
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id: { type: string, format: uuid }
 *         faculty_id: { type: string, format: uuid, nullable: true }
 *         program_id: { type: string, format: uuid, nullable: true }
 *         start_at: { type: string, format: date-time }
 *         end_at: { type: string, format: date-time }
 *         status:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *         created_by: { type: string, format: uuid }
 *         form_structure: { type: object, nullable: true }
 *         is_anonymous_allowed: { type: boolean }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *
 *     CreateElectionRequest:
 *       type: object
 *       required: [title, scope_type, period_id, start_at, end_at]
 *       properties:
 *         title: { type: string, maxLength: 255 }
 *         description: { type: string, maxLength: 5000, default: '' }
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *           default: VOTE
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id: { type: string, format: uuid }
 *         faculty_id: { type: string, format: uuid, nullable: true }
 *         program_id: { type: string, format: uuid, nullable: true }
 *         start_at: { type: string, format: date-time }
 *         end_at: { type: string, format: date-time }
 *         form_structure: { type: object, nullable: true }
 *         is_anonymous_allowed: { type: boolean, default: false }
 *
 *     UpdateElectionRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         title: { type: string, maxLength: 255 }
 *         description: { type: string, maxLength: 5000 }
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id: { type: string, format: uuid }
 *         faculty_id: { type: string, format: uuid, nullable: true }
 *         program_id: { type: string, format: uuid, nullable: true }
 *         start_at: { type: string, format: date-time }
 *         end_at: { type: string, format: date-time }
 *         form_structure: { type: object, nullable: true }
 *         is_anonymous_allowed: { type: boolean }
 *
 *     ChangeElectionStatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED]
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page: { type: integer }
 *         limit: { type: integer }
 *         total: { type: integer }
 *         totalPages: { type: integer }
 */
