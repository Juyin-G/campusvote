// src/modules/ballots/ballot.service.js
// S5-01 — Lógica de negocio de ballots.
// CRUD + create_ballot_version() + validate_ballot_completeness().

import * as ballotRepository from './ballot.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../shared/utils/pagination.js';

const translatePrismaError = (err) => {
  if (err?.code === 'P2025') {
    return ApiError.notFound('Boleta no encontrada');
  }

  if (err?.code === 'P2003') {
    return ApiError.badRequest('La elección indicada no existe');
  }

  if (err?.code === 'P2002') {
    return ApiError.conflict(
      'Ya existe una boleta con esa versión para la elección'
    );
  }

  return err;
};

export const listBallots = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  if (!query.election_id) {
    throw ApiError.badRequest('El election_id es obligatorio');
  }

  const [total, ballots] = await Promise.all([
    ballotRepository.countBallotsByElection(query.election_id),
    ballotRepository.listBallotsByElection(query.election_id, {
      skip,
      take,
    }),
  ]);

  return {
    ballots,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getBallotById = async (id) => {
  const ballot = await ballotRepository.findBallotById(id);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  return ballot;
};

export const createBallot = async (body = {}) => {
  if (!body.election_id) {
    throw ApiError.badRequest('El election_id es obligatorio');
  }

  try {
    return await ballotRepository.createBallot({
      election_id: body.election_id,
      version: body.version ?? 1,
      is_active: body.is_active ?? true,
    });
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateBallot = async (id, body = {}) => {
  const current = await ballotRepository.findBallotById(id);

  if (!current) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  const data = {};

  if (body.version !== undefined) {
    data.version = body.version;
  }

  if (body.is_active !== undefined) {
    data.is_active = body.is_active;
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(
      'No se proporcionaron datos para actualizar'
    );
  }

  try {
    return await ballotRepository.updateBallot(id, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteBallot = async (id) => {
  const ballot = await ballotRepository.findBallotById(id);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  try {
    await ballotRepository.deleteBallotById(id);

    return {
      deleted: true,
    };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const getActiveBallot = async (electionId) => {
  if (!electionId) {
    throw ApiError.badRequest('El election_id es obligatorio');
  }

  const ballot =
    await ballotRepository.getActiveBallot(electionId);

  if (!ballot) {
    throw ApiError.notFound(
      'No existe una boleta activa para esta elección'
    );
  }

  return ballot;
};

export const createBallotVersion = async (electionId) => {
  if (!electionId) {
    throw ApiError.badRequest('El election_id es obligatorio');
  }

  try {
    return await ballotRepository.createBallotVersion(
      electionId
    );
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const validateBallotCompleteness = async (
  ballotId
) => {
  const ballot =
    await ballotRepository.findBallotById(ballotId);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  const isComplete =
    await ballotRepository.validateBallotCompleteness(
      ballotId
    );

  return {
    ballotId,
    isComplete,
  };
};

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