/**
 * @openapi
 * components:
 *   schemas:
 *     OrganizationType:
 *       type: string
 *       enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *       example: UNIVERSITY
 *
 *     OrganizationRequestStatus:
 *       type: string
 *       enum: [PENDING, APPROVED, REJECTED]
 *       example: PENDING
 *
 *     Organization:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - code
 *         - org_type
 *         - is_active
 *         - onboarding_completed
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *         name:
 *           type: string
 *           example: "Universidad Nacional Mayor de San Marcos"
 *         code:
 *           type: string
 *           example: "UNMSM"
 *         org_type:
 *           $ref: '#/components/schemas/OrganizationType'
 *         is_active:
 *           type: boolean
 *           example: true
 *         logo:
 *           type: string
 *           nullable: true
 *           example: "https://storage.googleapis.com/bucket/logo.png"
 *         primary_color:
 *           type: string
 *           example: "#0066CC"
 *         secondary_color:
 *           type: string
 *           example: "#FFD700"
 *         country:
 *           type: string
 *           example: "Perú"
 *         timezone:
 *           type: string
 *           example: "America/Lima"
 *         onboarding_completed:
 *           type: boolean
 *           example: false
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-15T08:30:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-10T14:20:00.000Z"
 *
 *     CreateOrganizationRequest:
 *       type: object
 *       required:
 *         - name
 *         - code
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           example: "Instituto Tecnológico del Norte"
 *         code:
 *           type: string
 *           minLength: 1
 *           maxLength: 30
 *           example: "ITN"
 *         org_type:
 *           $ref: '#/components/schemas/OrganizationType'
 *         logo:
 *           type: string
 *           format: uri
 *           example: "https://storage.googleapis.com/bucket/itn-logo.png"
 *         primary_color:
 *           type: string
 *           pattern: '^#[0-9a-fA-F]{6}$'
 *           default: '#0066CC'
 *           example: "#0066CC"
 *         secondary_color:
 *           type: string
 *           pattern: '^#[0-9a-fA-F]{6}$'
 *           default: '#FFD700'
 *           example: "#FFD700"
 *         country:
 *           type: string
 *           default: 'Perú'
 *           example: "Perú"
 *         timezone:
 *           type: string
 *           default: 'America/Lima'
 *           example: "America/Lima"
 *
 *     UpdateOrganizationRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           example: "Universidad Nacional Mayor de San Marcos - Editado"
 *         code:
 *           type: string
 *           minLength: 1
 *           maxLength: 30
 *           example: "UNMSM-EDIT"
 *         org_type:
 *           $ref: '#/components/schemas/OrganizationType'
 *         logo:
 *           type: string
 *           format: uri
 *           example: "https://storage.googleapis.com/bucket/new-logo.png"
 *         primary_color:
 *           type: string
 *           pattern: '^#[0-9a-fA-F]{6}$'
 *           example: "#112233"
 *         secondary_color:
 *           type: string
 *           pattern: '^#[0-9a-fA-F]{6}$'
 *           example: "#445566"
 *         country:
 *           type: string
 *           example: "Chile"
 *         timezone:
 *           type: string
 *           example: "America/Santiago"
 *         is_active:
 *           type: boolean
 *           example: true
 *         onboarding_completed:
 *           type: boolean
 *           example: true
 *
 *     OrganizationRequest:
 *       type: object
 *       required:
 *         - id
 *         - institution_name
 *         - institution_type
 *         - country
 *         - estimated_members
 *         - contact_email
 *         - status
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "a8f1e2c3-d4b5-6c7d-8e9f-0a1b2c3d4e5f"
 *         institution_name:
 *           type: string
 *           example: "Pontificia Universidad Católica"
 *         institution_type:
 *           $ref: '#/components/schemas/OrganizationType'
 *         country:
 *           type: string
 *           example: "Perú"
 *         estimated_members:
 *           type: integer
 *           example: 1500
 *         contact_email:
 *           type: string
 *           format: email
 *           example: "contacto@puc.edu.pe"
 *         contact_phone:
 *           type: string
 *           nullable: true
 *           example: "+51987654321"
 *         message:
 *           type: string
 *           nullable: true
 *           example: "Deseamos implementar la plataforma para la facultad de ingeniería."
 *         status:
 *           $ref: '#/components/schemas/OrganizationRequestStatus'
 *         reviewed_by:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-02-15T10:00:00.000Z"
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-14T18:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-15T10:00:00.000Z"
 *
 *     CreateOrganizationRequestRequest:
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
 *           minLength: 1
 *           maxLength: 200
 *           example: "Pontificia Universidad Católica"
 *         institution_type:
 *           $ref: '#/components/schemas/OrganizationType'
 *         country:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           example: "Perú"
 *         estimated_members:
 *           type: integer
 *           minimum: 1
 *           example: 1500
 *         contact_email:
 *           type: string
 *           format: email
 *           example: "contacto@puc.edu.pe"
 *         contact_phone:
 *           type: string
 *           maxLength: 20
 *           example: "+51987654321"
 *         message:
 *           type: string
 *           maxLength: 1000
 *           example: "Deseamos implementar la plataforma para la facultad de ingeniería."
 */