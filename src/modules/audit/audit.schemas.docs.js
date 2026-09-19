/**
 * @file audit.schemas.docs.js
 * Schemas OpenAPI del módulo audit.
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         error:
 *           type: object
 *           properties:
 *             message: { type: string }
 *             details:
 *               type: array
 *               items: { type: string }
 *     AuditLog:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         actorId: { type: string, format: uuid, nullable: true }
 *         electionId: { type: string, format: uuid, nullable: true }
 *         action: { type: string }
 *         ipAddress: { type: string, nullable: true }
 *         metadata: { type: object }
 *         previousHash: { type: string }
 *         currentHash: { type: string }
 *         signature: { type: string }
 *         createdAt: { type: string, format: date-time }
 *
 *     OneTimeToken:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         electionId: { type: string, format: uuid }
 *         tokenHash: { type: string }
 *         expiresAt: { type: string, format: date-time }
 *         usedAt: { type: string, format: date-time, nullable: true }
 */
