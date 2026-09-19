// src/modules/ballots/ballotPositions/ballotPosition.crud.service.js
// CRUD de cargos del ballot.

import * as ballotPositionRepository from './ballotPosition.repository.js';
import {
  requireBallot,
  requirePosition,
  requireCandidateListInElection,
  translatePrismaError,
} from './ballotPosition.helpers.js';

const asInt = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asBool = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  return Boolean(v);
};

const asNullableText = (v) => {
  if (v === null) return null;
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

export const listBallotPositions = async (ballotId) => {
  await requireBallot(ballotId);
  return ballotPositionRepository.listByBallot(ballotId);
};

export const getBallotPositionById = async (ballotId, positionId) => {
  await requireBallot(ballotId);
  return requirePosition(ballotId, positionId);
};

export const createBallotPosition = async (ballotId, body = {}) => {
  const ballot = await requireBallot(ballotId);
  await requireCandidateListInElection(body.positionId, ballot.electionId);

  const data = {
    ballotId,
    positionId: body.positionId,
    title: (body.title || '').trim(),
    description: asNullableText(body.description ?? null),
    orderIndex: asInt(body.orderIndex ?? body.order_index, 0),
    minSelections: asInt(body.minSelections ?? body.min_selections, 1),
    maxSelections: asInt(body.maxSelections ?? body.max_selections, 1),
    allowsBlankVote: asBool(body.allowsBlankVote ?? body.allows_blank_vote, false),
    isRequired: asBool(body.isRequired ?? body.is_required, true),
    displayTogether: asBool(body.displayTogether ?? body.display_together, false),
  };

  if (data.minSelections > data.maxSelections) {
    throw new Error('minSelections no puede ser mayor que maxSelections');
  }

  try {
    return await ballotPositionRepository.create(data);
  } catch (err) {
    translatePrismaError(err);
  }
};

export const updateBallotPosition = async (ballotId, positionId, body = {}) => {
  const ballot = await requireBallot(ballotId);
  await requirePosition(ballotId, positionId);

  const data = {};
  if (body.title !== undefined) data.title = (body.title || '').trim();
  if (body.description !== undefined) data.description = asNullableText(body.description);
  if (body.orderIndex !== undefined || body.order_index !== undefined) {
    data.orderIndex = asInt(body.orderIndex ?? body.order_index, 0);
  }
  if (body.minSelections !== undefined || body.min_selections !== undefined) {
    data.minSelections = asInt(body.minSelections ?? body.min_selections, 1);
  }
  if (body.maxSelections !== undefined || body.max_selections !== undefined) {
    data.maxSelections = asInt(body.maxSelections ?? body.max_selections, 1);
  }
  if (body.allowsBlankVote !== undefined || body.allows_blank_vote !== undefined) {
    data.allowsBlankVote = asBool(body.allowsBlankVote ?? body.allows_blank_vote, false);
  }
  if (body.isRequired !== undefined || body.is_required !== undefined) {
    data.isRequired = asBool(body.isRequired ?? body.is_required, true);
  }
  if (body.displayTogether !== undefined || body.display_together !== undefined) {
    data.displayTogether = asBool(body.displayTogether ?? body.display_together, false);
  }
  if (Object.keys(data).length === 0) return null;

  if (data.minSelections && data.maxSelections && data.minSelections > data.maxSelections) {
    throw new Error('minSelections no puede ser mayor que maxSelections');
  }

  try {
    return await ballotPositionRepository.update(positionId, data);
  } catch (err) {
    translatePrismaError(err);
  }
};

export const deleteBallotPosition = async (ballotId, positionId) => {
  await requireBallot(ballotId);
  await requirePosition(ballotId, positionId);
  try {
    await ballotPositionRepository.delete(positionId);
    return { deleted: true, id: positionId };
  } catch (err) {
    translatePrismaError(err);
  }
};
