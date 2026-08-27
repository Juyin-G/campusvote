// src/modules/ballots/ballot.controller.js
// S5-01 — Controller HTTP para ballots.

import * as ballotService from './ballot.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import {
  sendSuccess,
  sendPaginated,
} from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

export const listBallots = asyncHandler(
  async (req, res) => {
    const { ballots, pagination } =
      await ballotService.listBallots(req.query);

    return sendPaginated(
      res,
      ballots,
      pagination,
      'Consulta exitosa'
    );
  }
);

export const getBallotById = asyncHandler(
  async (req, res) => {
    const ballot =
      await ballotService.getBallotById(
        req.params.id
      );

    return sendSuccess(
      res,
      ballot,
      'Boleta obtenida correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export const createBallot = asyncHandler(
  async (req, res) => {
    const ballot =
      await ballotService.createBallot(req.body);

    return sendSuccess(
      res,
      ballot,
      'Boleta creada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.CREATED
    );
  }
);

export const updateBallot = asyncHandler(
  async (req, res) => {
    const ballot =
      await ballotService.updateBallot(
        req.params.id,
        req.body
      );

    return sendSuccess(
      res,
      ballot,
      'Boleta actualizada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export const deleteBallot = asyncHandler(
  async (req, res) => {
    const result =
      await ballotService.deleteBallot(
        req.params.id
      );

    return sendSuccess(
      res,
      result,
      'Boleta eliminada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export const getActiveBallot = asyncHandler(
  async (req, res) => {
    const ballot =
      await ballotService.getActiveBallot(
        req.params.electionId
      );

    return sendSuccess(
      res,
      ballot,
      'Boleta activa obtenida correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export const createBallotVersion = asyncHandler(
  async (req, res) => {
    const ballot =
      await ballotService.createBallotVersion(
        req.params.electionId
      );

    return sendSuccess(
      res,
      ballot,
      'Nueva versión de boleta creada correctamente',
      { requestId: req.requestId },
      HTTP_STATUS.CREATED
    );
  }
);

export const validateBallotCompleteness = asyncHandler(
  async (req, res) => {
    const result =
      await ballotService.validateBallotCompleteness(
        req.params.id
      );

    return sendSuccess(
      res,
      result,
      'Validación de boleta completada',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  }
);

export default {
  listBallots,
  getBallotById,
  createBallot,
  updateBallot,
  deleteBallot,
  getActiveBallot,
  createBallotVersion,
  validateBallotCompleteness,
};