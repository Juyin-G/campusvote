// src/modules/ballots/ballotPositions/ballotPosition.controller.js
// S5-03 — Controller HTTP de posiciones de boleta.

import * as ballotPositionService from './ballotPosition.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../shared/constants/httpStatus.js';

/**
 * Listar posiciones de una boleta.
 * @route GET /api/ballots/:ballotId/positions
 * @access Autenticado
 */
export const listBallotPositions = asyncHandler(
  async (req, res) => {
    const { positions, total } =
      await ballotPositionService.listBallotPositions(
        req.params.ballotId
      );

    return sendSuccess(
      res,
      positions,
      'Consulta exitosa',
      {
        requestId: req.requestId,
        total,
      },
      HTTP_STATUS.OK
    );
  }
);

/**
 * Obtener una posición de la boleta.
 * @route GET /api/ballots/:ballotId/positions/:id
 * @access Autenticado
 */
export const getBallotPositionById = asyncHandler(
  async (req, res) => {
    const position =
      await ballotPositionService.getBallotPositionById(
        req.params.ballotId,
        req.params.id
      );

    return sendSuccess(
      res,
      position,
      'Posición de boleta obtenida correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

/**
 * Agregar una posición a la boleta.
 * @route POST /api/ballots/:ballotId/positions
 * @access ADMIN
 */
export const createBallotPosition = asyncHandler(
  async (req, res) => {
    const position =
      await ballotPositionService.createBallotPosition(
        req.params.ballotId,
        req.body
      );

    return sendSuccess(
      res,
      position,
      'Posición agregada a la boleta correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.CREATED
    );
  }
);

/**
 * Actualizar una posición de la boleta.
 * @route PUT /api/ballots/:ballotId/positions/:id
 * @access ADMIN
 */
export const updateBallotPosition = asyncHandler(
  async (req, res) => {
    const position =
      await ballotPositionService.updateBallotPosition(
        req.params.ballotId,
        req.params.id,
        req.body
      );

    return sendSuccess(
      res,
      position,
      'Posición de boleta actualizada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

/**
 * Eliminar una posición de la boleta.
 * @route DELETE /api/ballots/:ballotId/positions/:id
 * @access ADMIN
 */
export const deleteBallotPosition = asyncHandler(
  async (req, res) => {
    const result =
      await ballotPositionService.deleteBallotPosition(
        req.params.ballotId,
        req.params.id
      );

    return sendSuccess(
      res,
      result,
      'Posición eliminada de la boleta correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export default {
  listBallotPositions,
  getBallotPositionById,
  createBallotPosition,
  updateBallotPosition,
  deleteBallotPosition,
};