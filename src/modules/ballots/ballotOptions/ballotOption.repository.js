// src/modules/ballots/ballotOption.repository.js

import { prisma } from '../../../database/prisma.js';

const BALLOT_OPTION_SELECT = {
  id: true,
  ballotPositionId: true,
  electionId: true,
  optionType: true,
  candidateListId: true,
  label: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
};

export const findBallotOptionById = (id) =>
  prisma.ballotOption.findUnique({
    where: { id },
    select: BALLOT_OPTION_SELECT,
  });

export const findBallotOptionsByPosition = (ballotPositionId) =>
  prisma.ballotOption.findMany({
    where: {
      ballotPositionId: ballotPositionId,
    },
    select: BALLOT_OPTION_SELECT,
    orderBy: {
      orderIndex: 'asc',
    },
  });

export const countBallotOptionsByPosition = (ballotPositionId) =>
  prisma.ballotOption.count({
    where: {
      ballotPositionId: ballotPositionId,
    },
  });

export const createBallotOption = (data) =>
  prisma.ballotOption.create({
    data,
    select: BALLOT_OPTION_SELECT,
  });

export const updateBallotOption = (id, data) =>
  prisma.ballotOption.update({
    where: { id },
    data,
    select: BALLOT_OPTION_SELECT,
  });

export const deleteBallotOptionById = (id) =>
  prisma.ballotOption.delete({
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
  prisma.ballotOption.findFirst({
    where: {
      ballotPositionId: ballotPositionId,
      candidateListId: candidateListId,
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
  prisma.ballotOption.findFirst({
    where: {
      ballotPositionId: ballotPositionId,
      optionType: optionType,
    },
    select: BALLOT_OPTION_SELECT,
  });

// Nombres cortos que usa ballotOption.mutations.service.js; sin ellos
// crear/editar/borrar opciones de la cédula respondía 500.
export const create = createBallotOption;
export const update = updateBallotOption;
export { deleteBallotOptionById as delete };

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