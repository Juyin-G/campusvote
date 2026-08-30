// src/modules/ballots/ballotPosition.service.js

import * as ballotPositionRepository from '../ballotPositions/ballotPosition.repository.js';
import * as ballotRepository from '../ballot.repository.js';
import * as positionRepository from '../../elections/positions/position.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

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
    ballotPosition.ballotId !== ballotId
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

  if (position.electionId !== ballot.electionId) {
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

  // Soporte dual: camelCase o snake_case
  const targetPositionId = body.positionId ?? body.position_id;
  let targetOrderIndex = body.orderIndex ?? body.order_index;

  if (!targetPositionId) {
    throw ApiError.badRequest('El campo positionId o position_id es obligatorio');
  }

  await requirePositionForBallot(
    ballot,
    targetPositionId
  );

  const duplicatedPosition =
    await ballotPositionRepository.findByBallotAndPosition(
      ballotId,
      targetPositionId
    );

  if (duplicatedPosition) {
    throw ApiError.conflict(
      'Este cargo ya fue agregado a la boleta'
    );
  }

  /**
   * Si no envían order_index u orderIndex,
   * se agrega al final automáticamente.
   */
  if (targetOrderIndex === undefined || targetOrderIndex === null) {
    const count =
      await ballotPositionRepository.countBallotPositionsByBallot(
        ballotId
      );

    targetOrderIndex = count + 1;
  }

  const duplicatedOrder =
    await ballotPositionRepository.findByBallotAndOrder(
      ballotId,
      Number(targetOrderIndex)
    );

  if (duplicatedOrder) {
    throw ApiError.conflict(
      'Ese orden ya está ocupado dentro de la boleta'
    );
  }

  try {
    return await ballotPositionRepository.createBallotPosition({
      ballotId,
      positionId: targetPositionId,
      orderIndex: Number(targetOrderIndex),
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
  const targetPositionId = body.positionId ?? body.position_id;
  const targetOrderIndex = body.orderIndex ?? body.order_index;

  if (
    targetPositionId !== undefined &&
    targetPositionId !== current.positionId
  ) {
    await requirePositionForBallot(
      ballot,
      targetPositionId
    );

    const duplicatedPosition =
      await ballotPositionRepository.findByBallotAndPosition(
        ballotId,
        targetPositionId
      );

    if (
      duplicatedPosition &&
      duplicatedPosition.id !== ballotPositionId
    ) {
      throw ApiError.conflict(
        'Este cargo ya fue agregado a la boleta'
      );
    }

    data.positionId = targetPositionId;
  }

  if (
    targetOrderIndex !== undefined &&
    Number(targetOrderIndex) !== current.orderIndex
  ) {
    const duplicatedOrder =
      await ballotPositionRepository.findByBallotAndOrder(
        ballotId,
        Number(targetOrderIndex)
      );

    if (
      duplicatedOrder &&
      duplicatedOrder.id !== ballotPositionId
    ) {
      throw ApiError.conflict(
        'Ese orden ya está ocupado dentro de la boleta'
      );
    }

    data.orderIndex = Number(targetOrderIndex);
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