/**
 * @file project.schemas.docs.js
 * Schemas OpenAPI (componentes) del módulo de proyectos de feria.
 * @openapi
 * components:
 *   schemas:
 *     ProjectMemberProfile:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         first_name: { type: string, nullable: true }
 *         last_name: { type: string, nullable: true }
 *         institutional_id: { type: string, nullable: true }
 *         role:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, SUPERADMIN, JURY]
 *     ProjectMember:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         user_id: { type: string, format: uuid }
 *         role:
 *           type: string
 *           enum: [EXPOSITOR, COLLABORATOR, ADVISOR]
 *         created_at: { type: string, format: date-time }
 *         user: { $ref: '#/components/schemas/ProjectMemberProfile' }
 *     Project:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         organization_id: { type: string, format: uuid }
 *         fair_id:
 *           type: string
 *           format: uuid
 *           description: Feria del proyecto (fuente de verdad de la organización)
 *         fair:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             status:
 *               type: string
 *               enum: [DRAFT, OPEN, CLOSED]
 *         created_by: { $ref: '#/components/schemas/ProjectMemberProfile' }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         logo_url: { type: string, format: uri, nullable: true }
 *         cover_url: { type: string, format: uri, nullable: true }
 *         project_url: { type: string, format: uri, nullable: true }
 *         status:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *         review_notes: { type: string, nullable: true }
 *         reviewed_by: { type: string, format: uuid, nullable: true }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         submitted_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         members:
 *           type: array
 *           items: { $ref: '#/components/schemas/ProjectMember' }
 *         is_owner: { type: boolean }
 */
