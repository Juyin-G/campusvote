// src/modules/ballots/ballotOptions/ballotOption.mutations.service.js
// Creación, actualización y eliminación de opciones.

import * as ballotOptionRepository from './ballotOption.repository.js';
import {
  requireBallotPosition,
  requireOptionInPosition,
  validateOptionData,
  translatePrismaError,
} from './ballotOption.helpers.js';

export const createBallotOption = async (ballotPositionId, body = {}) => {
  const ballotPosition = await requireBallotPosition(ballotPositionId);
  const data = await validateOptionData({ body, ballotPosition, isUpdate: false });
  try {
    return await ballotOptionRepository.create({
      ballotPositionId,
      ...data,
    });
  } catch (err) {
    translatePrismaError(err);
  }
};

export const updateBallotOption = async (ballotPositionId, optionId, body = {}) => {
  const ballotPosition = await requireBallotPosition(ballotPositionId);
  await requireOptionInPosition(ballotPositionId, optionId);
  const data = await validateOptionData({ body, ballotPosition, isUpdate: true });
  if (Object.keys(data).length === 0) return null;
  try {
    return await ballotOptionRepository.update(optionId, data);
  } catch (err) {
    translatePrismaError(err);
  }
};

export const deleteBallotOption = async (ballotPositionId, optionId) => {
  await requireBallotPosition(ballotPositionId);
  await requireOptionInPosition(ballotPositionId, optionId);
  try {
    await ballotOptionRepository.delete(optionId);
    return { deleted: true, id: optionId };
  } catch (err) {
    translatePrismaError(err);
  }
};
