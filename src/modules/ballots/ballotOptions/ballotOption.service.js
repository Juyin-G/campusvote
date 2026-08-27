// src/modules/ballots/ballotOption.service.js

import * as ballotOptionRepository from './ballotOption.repository.js';
import * as ballotPositionRepository from '../ballotPositions/ballotPosition.repository.js';
import * as ballotRepository from '../ballot.repository.js';
import * as candidateListRepository from '../../elections/candidateList/candidateList.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

const OPTION_TYPES = [
  'CANDIDATE_LIST',
  'BLANK',
  'VOID',
];

const asText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict(
      'La opción ya existe dentro de esta posición de boleta'
    );
  }

  if (err?.code === 'P2025') {
    return ApiError.notFound(
      'La opción de boleta solicitada no existe'
    );
  }

  if (err?.code === 'P2003') {
    return ApiError.badRequest(
      'La posición o lista candidata indicada no existe'
    );
  }

  return err;
};

/**
 * Verifica que la posición de boleta exista.
 */
const requireBallotPosition = async (ballotPositionId) => {
  const ballotPosition =
    await ballotPositionRepository.findBallotPositionById(
      ballotPositionId
    );

  if (!ballotPosition) {
    throw ApiError.notFound(
      'Posición de boleta no encontrada'
    );
  }

  return ballotPosition;
};

/**
 * Verifica que una opción pertenezca a la posición indicada.
 */
const requireOptionInPosition = async (
  ballotPositionId,
  optionId
) => {
  const option =
    await ballotOptionRepository.findBallotOptionById(
      optionId
    );

  const currentPositionId = option?.ballotPositionId ?? option?.ballot_position_id;

  if (!option || currentPositionId !== ballotPositionId) {
    throw ApiError.notFound(
      'La opción solicitada no existe en esta posición de boleta'
    );
  }

  return option;
};

/**
 * Verifica que una lista candidata pertenezca
 * a la misma elección que la boleta.
 */
const requireCandidateListForBallot = async (
  ballotPosition,
  candidateListId
) => {
  const ballotId = ballotPosition.ballotId ?? ballotPosition.ballot_id;

  const ballot =
    await ballotRepository.findBallotById(ballotId);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  const candidateList =
    await candidateListRepository.findCandidateListById(
      candidateListId
    );

  if (!candidateList) {
    throw ApiError.notFound(
      'Lista candidata no encontrada'
    );
  }

  const candidateListElectionId = candidateList.electionId ?? candidateList.election_id;
  const ballotElectionId = ballot.electionId ?? ballot.election_id;

  if (candidateListElectionId !== ballotElectionId) {
    throw ApiError.badRequest(
      'La lista candidata no pertenece a la misma elección de la boleta'
    );
  }

  return candidateList;
};

/**
 * Valida las reglas según option_type.
 */
const validateOptionData = async (
  ballotPosition,
  optionType,
  candidateListId,
  currentOptionId = null
) => {
  if (!OPTION_TYPES.includes(optionType)) {
    throw ApiError.badRequest(
      'Tipo de opción de boleta inválido'
    );
  }

  if (optionType === 'CANDIDATE_LIST') {
    if (!candidateListId) {
      throw ApiError.badRequest(
        'candidateListId es obligatorio para CANDIDATE_LIST'
      );
    }

    await requireCandidateListForBallot(
      ballotPosition,
      candidateListId
    );

    const duplicated =
      await ballotOptionRepository.findByPositionAndCandidateList(
        ballotPosition.id,
        candidateListId
      );

    if (
      duplicated &&
      duplicated.id !== currentOptionId
    ) {
      throw ApiError.conflict(
        'Esta lista candidata ya fue agregada a la posición'
      );
    }

    return;
  }

  // BLANK y VOID no pueden tener candidate_list_id
  if (candidateListId) {
    throw ApiError.badRequest(
      `${optionType} no debe tener candidateListId`
    );
  }

  const duplicatedSpecial =
    await ballotOptionRepository.findSpecialOptionByType(
      ballotPosition.id,
      optionType
    );

  if (
    duplicatedSpecial &&
    duplicatedSpecial.id !== currentOptionId
  ) {
    throw ApiError.conflict(
      `Ya existe una opción ${optionType} en esta posición`
    );
  }
};

/**
 * Listar opciones de una posición de boleta.
 */
export const listBallotOptions = async (
  ballotPositionId
) => {
  await requireBallotPosition(ballotPositionId);

  const options =
    await ballotOptionRepository.findBallotOptionsByPosition(
      ballotPositionId
    );

  return {
    options,
    total: options.length,
  };
};

/**
 * Obtener una opción por ID.
 */
export const getBallotOptionById = async (
  ballotPositionId,
  optionId
) => {
  await requireBallotPosition(ballotPositionId);

  return requireOptionInPosition(
    ballotPositionId,
    optionId
  );
};

/**
 * Crear opción.
 */
export const createBallotOption = async (
  ballotPositionId,
  body = {}
) => {
  const ballotPosition =
    await requireBallotPosition(ballotPositionId);

  const optionType =
    body.optionType ?? body.option_type ?? 'CANDIDATE_LIST';

  const candidateListId =
    body.candidateListId ?? body.candidate_list_id ?? null;

  await validateOptionData(
    ballotPosition,
    optionType,
    candidateListId
  );

  const electionId = ballotPosition.electionId ?? ballotPosition.election_id;

  const data = {
    ballotPositionId,
    ballot_position_id: ballotPositionId,
    electionId,
    election_id: electionId,
    optionType,
    option_type: optionType,
    candidateListId: optionType === 'CANDIDATE_LIST' ? candidateListId : null,
    candidate_list_id: optionType === 'CANDIDATE_LIST' ? candidateListId : null,
    label: asText(body.label),
    orderIndex: body.orderIndex ?? body.order_index ?? 1,
    order_index: body.orderIndex ?? body.order_index ?? 1,
  };

  try {
    return await ballotOptionRepository.createBallotOption(
      data
    );
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * Actualizar opción.
 */
export const updateBallotOption = async (
  ballotPositionId,
  optionId,
  body = {}
) => {
  const ballotPosition =
    await requireBallotPosition(ballotPositionId);

  const current =
    await requireOptionInPosition(
      ballotPositionId,
      optionId
    );

  const currentOptionType = current.optionType ?? current.option_type;
  const currentCandidateListId = current.candidateListId ?? current.candidate_list_id;

  const optionType =
    body.optionType ?? body.option_type ?? currentOptionType;

  const rawCandidateListId = body.candidateListId ?? body.candidate_list_id;
  const candidateListId =
    rawCandidateListId !== undefined
      ? rawCandidateListId
      : currentCandidateListId;

  await validateOptionData(
    ballotPosition,
    optionType,
    candidateListId,
    optionId
  );

  const data = {};

  if (body.optionType !== undefined || body.option_type !== undefined) {
    data.optionType = optionType;
    data.option_type = optionType;

    if (optionType === 'BLANK' || optionType === 'VOID') {
      data.candidateListId = null;
      data.candidate_list_id = null;
    }
  }

  if (body.candidateListId !== undefined || body.candidate_list_id !== undefined) {
    data.candidateListId = rawCandidateListId;
    data.candidate_list_id = rawCandidateListId;
  }

  if (body.label !== undefined) {
    data.label = asText(body.label);
  }

  if (body.orderIndex !== undefined || body.order_index !== undefined) {
    const order = body.orderIndex ?? body.order_index;
    data.orderIndex = order;
    data.order_index = order;
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(
      'No se proporcionaron cambios para actualizar'
    );
  }

  try {
    return await ballotOptionRepository.updateBallotOption(
      optionId,
      data
    );
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * Eliminar opción.
 */
export const deleteBallotOption = async (
  ballotPositionId,
  optionId
) => {
  await requireBallotPosition(ballotPositionId);

  await requireOptionInPosition(
    ballotPositionId,
    optionId
  );

  try {
    await ballotOptionRepository.deleteBallotOptionById(
      optionId
    );

    return {
      deleted: true,
    };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  listBallotOptions,
  getBallotOptionById,
  createBallotOption,
  updateBallotOption,
  deleteBallotOption,
};