// src/modules/ballots/ballotOption.repository.js

import { prisma } from '../../../database/prisma.js';

const BALLOT_OPTION_SELECT = {
  id: true,
  ballot_position_id: true,
  election_id: true,
  option_type: true,
  candidate_list_id: true,
  label: true,
  order_index: true,
  created_at: true,
  updated_at: true,
};

export const findBallotOptionById = (id) =>
  prisma.ballot_options.findUnique({
    where: { id },
    select: BALLOT_OPTION_SELECT,
  });

export const findBallotOptionsByPosition = (ballotPositionId) =>
  prisma.ballot_options.findMany({
    where: {
      ballot_position_id: ballotPositionId,
    },
    select: BALLOT_OPTION_SELECT,
    orderBy: {
      order_index: 'asc',
    },
  });

export const countBallotOptionsByPosition = (ballotPositionId) =>
  prisma.ballot_options.count({
    where: {
      ballot_position_id: ballotPositionId,
    },
  });

export const createBallotOption = (data) =>
  prisma.ballot_options.create({
    data,
    select: BALLOT_OPTION_SELECT,
  });

export const updateBallotOption = (id, data) =>
  prisma.ballot_options.update({
    where: { id },
    data,
    select: BALLOT_OPTION_SELECT,
  });

export const deleteBallotOptionById = (id) =>
  prisma.ballot_options.delete({
    where: { id },
    select: {
      id: true,
    },
  });

/**
 * Busca si una lista candidata ya está registrada
 * como opción en una posición de boleta.
 */
export const findByPositionAndCandidateList = (
  ballotPositionId,
  candidateListId,
) =>
  prisma.ballot_options.findFirst({
    where: {
      ballot_position_id: ballotPositionId,
      candidate_list_id: candidateListId,
    },
    select: BALLOT_OPTION_SELECT,
  });

/**
 * Busca una opción especial (BLANK o VOID)
 * dentro de una posición.
 */
export const findSpecialOptionByType = (
  ballotPositionId,
  optionType,
) =>
  prisma.ballot_options.findFirst({
    where: {
      ballot_position_id: ballotPositionId,
      option_type: optionType,
    },
    select: BALLOT_OPTION_SELECT,
  });

export default {
  findBallotOptionById,
  findBallotOptionsByPosition,
  countBallotOptionsByPosition,
  createBallotOption,
  updateBallotOption,
  deleteBallotOptionById,
  findByPositionAndCandidateList,
  findSpecialOptionByType,
};