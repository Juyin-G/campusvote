// src/modules/ballots/ballot.service.js

import * as ballotRepository from './ballot.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../shared/utils/pagination.js';
import * as electionRepository from '../elections/elections/election.repository.js';

const assertBallotScope = async (ballot, actor) => {
  if (!actor || actor.role === 'SUPERADMIN' || actor.isSuperuser) return;
  const organizationId = await electionRepository.findElectionOwnerOrganization(ballot.electionId);
  if (!actor.organizationId || organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La boleta no pertenece a tu organización');
  }
};

const assertElectionScope = async (electionId, actor) => {
  const organizationId =
    await electionRepository.findElectionOwnerOrganization(electionId);
  if (!organizationId) {
    throw ApiError.notFound('Elección no encontrada');
  }
  if (
    actor &&
    actor.role !== 'SUPERADMIN' &&
    !actor.isSuperuser &&
    (!actor.organizationId || actor.organizationId !== organizationId)
  ) {
    throw ApiError.forbidden('La elección no pertenece a tu organización');
  }
};

const translatePrismaError = (err) => {
  // Manejo explícito de excepciones lanzadas por funciones/triggers PL/pgSQL
  if (err?.code === 'P2010' || err?.code === 'P2034') {
    const message = err.meta?.message || err.message || '';
    if (message.includes('bloqueada') || message.includes('estado')) {
      return ApiError.badRequest(message);
    }
  }

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

export const listBallots = async (query = {}, actor) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  // Acepta tanto electionId como election_id por compatibilidad
  const electionId = query.electionId || query.election_id;

  if (!electionId) {
    throw ApiError.badRequest('El ID de la elección es obligatorio');
  }
  await assertElectionScope(electionId, actor);

  const [total, ballots] = await Promise.all([
    ballotRepository.countBallotsByElection(electionId),
    ballotRepository.listBallotsByElection(electionId, { skip, take }),
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

export const getBallotById = async (id, actor) => {
  const ballot = await ballotRepository.findBallotById(id);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }
  await assertBallotScope(ballot, actor);

  return ballot;
};

export const createBallot = async (body = {}, actor) => {
  const electionId = body.electionId || body.election_id;

  if (!electionId) {
    throw ApiError.badRequest('El ID de la elección es obligatorio');
  }
  await assertElectionScope(electionId, actor);

  try {
    return await ballotRepository.createBallot({
      electionId,
      version: body.version ?? 1,
      isActive: body.isActive ?? body.is_active ?? true,
    });
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateBallot = async (id, body = {}, actor) => {
  const current = await ballotRepository.findBallotById(id);

  if (!current) {
    throw ApiError.notFound('Boleta no encontrada');
  }
  await assertBallotScope(current, actor);

  const data = {};

  if (body.version !== undefined) {
    data.version = body.version;
  }

  if (body.isActive !== undefined) {
    data.isActive = body.isActive;
  } else if (body.is_active !== undefined) {
    data.isActive = body.is_active;
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

export const deleteBallot = async (id, actor) => {
  const ballot = await ballotRepository.findBallotById(id);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }
  await assertBallotScope(ballot, actor);

  try {
    await ballotRepository.deleteBallotById(id);

    return {
      deleted: true,
    };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const getActiveBallot = async (electionId, actor) => {
  if (!electionId) {
    throw ApiError.badRequest('El ID de la elección es obligatorio');
  }
  await assertElectionScope(electionId, actor);

  const ballot = await ballotRepository.getActiveBallot(electionId);

  if (!ballot) {
    throw ApiError.notFound(
      'No existe una boleta activa para esta elección'
    );
  }

  return ballot;
};

export const createBallotVersion = async (electionId, actor) => {
  if (!electionId) {
    throw ApiError.badRequest('El ID de la elección es obligatorio');
  }
  await assertElectionScope(electionId, actor);

  try {
    return await ballotRepository.createBallotVersion(electionId);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const validateBallotCompleteness = async (ballotId, actor) => {
  const ballot = await ballotRepository.findBallotById(ballotId);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }
  await assertBallotScope(ballot, actor);

  const isComplete = await ballotRepository.validateBallotCompleteness(
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