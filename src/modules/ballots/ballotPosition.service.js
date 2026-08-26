// src/modules/ballots/ballotPosition.service.js
// S5-03 — Lógica de negocio de posiciones dentro de una boleta.

import * as ballotPositionRepository from './ballotPosition.repository.js';
import * as ballotRepository from './ballot.repository.js';
import * as positionRepository from '../elections/position.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict(
      'La posición o el orden ya están registrados en esta boleta'
    );
  }

  if (err?.code === 'P2025') {
    return ApiError.notFound(
      'La posición de boleta solicitada no existe'
    );
  }

  if (err?.code === 'P2003') {
    return ApiError.badRequest(
      'La boleta o el cargo indicado no existe'
    );
  }

  return err;
};

/**
 * Verifica que la boleta exista.
 */
const requireBallot = async (ballotId) => {
  const ballot = await ballotRepository.findBallotById(ballotId);

  if (!ballot) {
    throw ApiError.notFound('Boleta no encontrada');
  }

  return ballot;
};

/**
 * Verifica que la posición de boleta exista
 * y pertenezca a la boleta indicada.
 */
const requireBallotPosition = async (
  ballotId,
  ballotPositionId
) => {
  const ballotPosition =
    await ballotPositionRepository.findBallotPositionById(
      ballotPositionId
    );

  if (
    !ballotPosition ||
    ballotPosition.ballot_id !== ballotId
  ) {
    throw ApiError.notFound(
      'La posición solicitada no existe en esta boleta'
    );
  }

  return ballotPosition;
};

/**
 * Verifica que el cargo exista y que pertenezca
 * a la misma elección de la boleta.
 */
const requirePositionForBallot = async (
  ballot,
  positionId
) => {
  const position =
    await positionRepository.findPositionById(positionId);

  if (!position) {
    throw ApiError.notFound('Cargo no encontrado');
  }

  if (position.election_id !== ballot.election_id) {
    throw ApiError.badRequest(
      'El cargo no pertenece a la misma elección de la boleta'
    );
  }

  return position;
};

/**
 * Listar posiciones de una boleta.
 */
export const listBallotPositions = async (ballotId) => {
  await requireBallot(ballotId);

  const positions =
    await ballotPositionRepository.findBallotPositionsByBallot(
      ballotId
    );

  return {
    positions,
    total: positions.length,
  };
};

/**
 * Obtener una posición específica de la boleta.
 */
export const getBallotPositionById = async (
  ballotId,
  ballotPositionId
) => {
  await requireBallot(ballotId);

  return requireBallotPosition(
    ballotId,
    ballotPositionId
  );
};

/**
 * Agregar un cargo a la boleta.
 */
export const createBallotPosition = async (
  ballotId,
  body = {}
) => {
  const ballot = await requireBallot(ballotId);

  await requirePositionForBallot(
    ballot,
    body.position_id
  );

  const duplicatedPosition =
    await ballotPositionRepository.findByBallotAndPosition(
      ballotId,
      body.position_id
    );

  if (duplicatedPosition) {
    throw ApiError.conflict(
      'Este cargo ya fue agregado a la boleta'
    );
  }

  let orderIndex = body.order_index;

  /**
   * Si no envían order_index,
   * se agrega al final automáticamente.
   */
  if (orderIndex === undefined) {
    const count =
      await ballotPositionRepository.countBallotPositionsByBallot(
        ballotId
      );

    orderIndex = count + 1;
  }

  const duplicatedOrder =
    await ballotPositionRepository.findByBallotAndOrder(
      ballotId,
      Number(orderIndex)
    );

  if (duplicatedOrder) {
    throw ApiError.conflict(
      'Ese orden ya está ocupado dentro de la boleta'
    );
  }

  try {
    return await ballotPositionRepository.createBallotPosition({
      ballot_id: ballotId,
      position_id: body.position_id,
      order_index: Number(orderIndex),
    });
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * Actualizar posición de boleta.
 */
export const updateBallotPosition = async (
  ballotId,
  ballotPositionId,
  body = {}
) => {
  const ballot = await requireBallot(ballotId);

  const current = await requireBallotPosition(
    ballotId,
    ballotPositionId
  );

  const data = {};

  if (
    body.position_id !== undefined &&
    body.position_id !== current.position_id
  ) {
    await requirePositionForBallot(
      ballot,
      body.position_id
    );

    const duplicatedPosition =
      await ballotPositionRepository.findByBallotAndPosition(
        ballotId,
        body.position_id
      );

    if (
      duplicatedPosition &&
      duplicatedPosition.id !== ballotPositionId
    ) {
      throw ApiError.conflict(
        'Este cargo ya fue agregado a la boleta'
      );
    }

    data.position_id = body.position_id;
  }

  if (
    body.order_index !== undefined &&
    Number(body.order_index) !== current.order_index
  ) {
    const duplicatedOrder =
      await ballotPositionRepository.findByBallotAndOrder(
        ballotId,
        Number(body.order_index)
      );

    if (
      duplicatedOrder &&
      duplicatedOrder.id !== ballotPositionId
    ) {
      throw ApiError.conflict(
        'Ese orden ya está ocupado dentro de la boleta'
      );
    }

    data.order_index = Number(body.order_index);
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(
      'No se proporcionaron cambios para actualizar'
    );
  }

  try {
    return await ballotPositionRepository.updateBallotPosition(
      ballotPositionId,
      data
    );
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * Eliminar posición de la boleta.
 */
export const deleteBallotPosition = async (
  ballotId,
  ballotPositionId
) => {
  await requireBallot(ballotId);

  await requireBallotPosition(
    ballotId,
    ballotPositionId
  );

  try {
    await ballotPositionRepository.deleteBallotPositionById(
      ballotPositionId
    );

    return {
      deleted: true,
    };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  listBallotPositions,
  getBallotPositionById,
  createBallotPosition,
  updateBallotPosition,
  deleteBallotPosition,
};