// src/modules/ballots/ballotOption.repository.js
// S5-06 — Acceso a datos de ballot_options vía Prisma.

import { prisma } from '../../database/prisma.js';

const BALLOT_OPTION_SELECT = {
  id: true,
  ballot_position_id: true,
  option_type: true,
  candidate_list_id: true,
  label: true,
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
      created_at: 'asc',
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
 * Busca una opción especial BLANK o NULL
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