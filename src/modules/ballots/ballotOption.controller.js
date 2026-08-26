// src/modules/ballots/ballotOption.controller.js
// S5-05 — Controller HTTP de opciones de boleta.

import * as ballotOptionService from './ballotOption.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

/**
 * Listar opciones de una posición.
 * @route GET /api/ballot-positions/:ballotPositionId/options
 * @access Autenticado
 */
export const listBallotOptions = asyncHandler(
  async (req, res) => {
    const { options, total } =
      await ballotOptionService.listBallotOptions(
        req.params.ballotPositionId
      );

    return sendSuccess(
      res,
      options,
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
 * Obtener opción por ID.
 * @route GET /api/ballot-positions/:ballotPositionId/options/:id
 * @access Autenticado
 */
export const getBallotOptionById = asyncHandler(
  async (req, res) => {
    const option =
      await ballotOptionService.getBallotOptionById(
        req.params.ballotPositionId,
        req.params.id
      );

    return sendSuccess(
      res,
      option,
      'Opción de boleta obtenida correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

/**
 * Crear opción.
 * @route POST /api/ballot-positions/:ballotPositionId/options
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const createBallotOption = asyncHandler(
  async (req, res) => {
    const option =
      await ballotOptionService.createBallotOption(
        req.params.ballotPositionId,
        req.body
      );

    return sendSuccess(
      res,
      option,
      'Opción agregada a la boleta correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.CREATED
    );
  }
);

/**
 * Actualizar opción.
 * @route PUT /api/ballot-positions/:ballotPositionId/options/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const updateBallotOption = asyncHandler(
  async (req, res) => {
    const option =
      await ballotOptionService.updateBallotOption(
        req.params.ballotPositionId,
        req.params.id,
        req.body
      );

    return sendSuccess(
      res,
      option,
      'Opción de boleta actualizada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

/**
 * Eliminar opción.
 * @route DELETE /api/ballot-positions/:ballotPositionId/options/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const deleteBallotOption = asyncHandler(
  async (req, res) => {
    const result =
      await ballotOptionService.deleteBallotOption(
        req.params.ballotPositionId,
        req.params.id
      );

    return sendSuccess(
      res,
      result,
      'Opción eliminada de la boleta correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);