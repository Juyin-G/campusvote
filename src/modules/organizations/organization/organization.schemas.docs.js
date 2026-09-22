// src/modules/organizations/organization/organization.schemas.docs.js
// OpenAPI: schemas compartidos del módulo de organización.

/**
 * @openapi
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         code: { type: string }
 *         org_type:
 *           type: string
 *           enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *         is_active: { type: boolean }
 *         logo: { type: string, format: uri, nullable: true }
 *         primary_color: { type: string, pattern: "^#[0-9a-fA-F]{6}$" }
 *         secondary_color: { type: string, pattern: "^#[0-9a-fA-F]{6}$" }
 *         country: { type: string }
 *         timezone: { type: string }
 *         onboarding_completed: { type: boolean }
 *         onboarding_completed_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *
 *     OrganizationRequest:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         institution_name: { type: string }
 *         institution_type:
 *           type: string
 *           enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *         country: { type: string }
 *         estimated_members: { type: integer }
 *         contact_email: { type: string, format: email }
 *         contact_phone: { type: string, nullable: true }
 *         message: { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         reviewed_by: { type: string, format: uuid, nullable: true }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         rejection_reason: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page: { type: integer }
 *         limit: { type: integer }
 *         total: { type: integer }
 *         totalPages: { type: integer }
 */
