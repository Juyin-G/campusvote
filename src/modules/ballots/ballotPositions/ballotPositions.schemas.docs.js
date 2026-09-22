// src/modules/ballots/ballotPositions/ballotPositions.schemas.docs.js
// OpenAPI: schemas del módulo ballotPositions.

/**
 * @openapi
 * components:
 *   schemas:
 *     BallotPosition:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         ballotId: { type: string, format: uuid }
 *         positionId: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         orderIndex: { type: integer }
 *         minSelections: { type: integer }
 *         maxSelections: { type: integer }
 *         allowsBlankVote: { type: boolean }
 *         isRequired: { type: boolean }
 *         displayTogether: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         position:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             description: { type: string, nullable: true }
 *
 *     CreateBallotPositionRequest:
 *       type: object
 *       required: [positionId, title]
 *       properties:
 *         positionId: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string }
 *         orderIndex: { type: integer }
 *         minSelections: { type: integer, default: 1 }
 *         maxSelections: { type: integer, default: 1 }
 *         allowsBlankVote: { type: boolean, default: false }
 *         isRequired: { type: boolean, default: true }
 *         displayTogether: { type: boolean, default: false }
 */
