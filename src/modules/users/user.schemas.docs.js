/**
 * @file user.schemas.docs.js
 * Schemas OpenAPI (componentes) del módulo de usuarios.
 * @swagger
 * tags:
 *   - name: Users
 *     description: Gestión de usuarios
 *
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         username: { type: string }
 *         email: { type: string, format: email }
 *         first_name: { type: string }
 *         last_name: { type: string }
 *         institutional_id: { type: string }
 *         role:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, SUPERADMIN, JURY]
 *         is_active: { type: boolean }
 *         is_verified: { type: boolean }
 *         is_staff: { type: boolean }
 *         is_superuser: { type: boolean }
 *         organization_id: { type: string, format: uuid }
 *         two_factor_enabled: { type: boolean }
 *         must_change_password: { type: boolean }
 *         last_login: { type: string, format: date-time }
 *         date_joined: { type: string, format: date-time }
 *     CreateUserRequest:
 *       type: object
 *       required: [username, email, password, first_name, last_name, institutional_id, role]
 *       properties:
 *         username: { type: string }
 *         email: { type: string, format: email }
 *         password: { type: string, minLength: 8 }
 *         first_name: { type: string }
 *         last_name: { type: string }
 *         institutional_id: { type: string }
 *         role:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, JURY]
 *         organization_id: { type: string, format: uuid }
 *         program_id: { type: string, format: uuid }
 *         faculty_id: { type: string, format: uuid }
 *         current_cycle: { type: integer }
 *         document_type:
 *           type: string
 *           enum: [DNI, CE]
 *         document_number: { type: string }
 *         scope_level:
 *           type: string
 *           enum: [ORG, REGION, SITE]
 *         region_id: { type: string, format: uuid }
 *         site_ids:
 *           type: array
 *           items: { type: string, format: uuid }
 */
