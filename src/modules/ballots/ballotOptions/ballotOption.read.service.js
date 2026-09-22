// src/modules/ballots/ballotOptions/ballotOption.read.service.js
// Lectura de opciones de ballot (list + getById).

import * as ballotOptionRepository from './ballotOption.repository.js';
import { requireBallotPosition, requireOptionInPosition } from './ballotOption.helpers.js';

export const listBallotOptions = async (ballotPositionId) => {
  await requireBallotPosition(ballotPositionId);
  const options = await ballotOptionRepository.findBallotOptionsByPosition(ballotPositionId);
  return { options, total: options.length };
};

export const getBallotOptionById = async (ballotPositionId, optionId) => {
  await requireBallotPosition(ballotPositionId);
  return requireOptionInPosition(ballotPositionId, optionId);
};
