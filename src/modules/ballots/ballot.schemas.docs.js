// src/modules/ballots/ballot.schemas.docs.js
// OpenAPI: schemas del módulo ballots.

/**
 * @openapi
 * components:
 *   schemas:
 *     Ballot:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         electionId: { type: string, format: uuid }
 *         version: { type: integer, minimum: 1 }
 *         isActive: { type: boolean }
 *         generatedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         positions:
 *           type: array
 *           items: { $ref: '#/components/schemas/BallotPosition' }
 *     BallotCompleteness:
 *       type: object
 *       properties:
 *         isComplete: { type: boolean }
 *         totalPositions: { type: integer }
 *         positionsWithOption: { type: integer }
 *         missingPositionIds:
 *           type: array
 *           items: { type: string, format: uuid }
 */
