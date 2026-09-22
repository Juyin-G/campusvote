/**
 * @file faculty.schemas.docs.js
 * Schemas OpenAPI del módulo academic/faculty.
 * @openapi
 * tags:
 *   name: Academic
 *   description: Gestión de facultades, programas y periodos académicos
 *
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Faculty:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         code: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         total: { type: integer }
 *         skip: { type: integer }
 *         take: { type: integer }
 *         hasMore: { type: boolean }
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         message: { type: string }
 *         data: { type: object }
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         message: { type: string }
 */
