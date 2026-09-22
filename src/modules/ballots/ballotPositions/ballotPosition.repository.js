// src/modules/ballots/ballotPosition.repository.js
// S5-04 — Acceso a datos de ballot_positions vía Prisma.

import { prisma } from '../../../database/prisma.js';

/**
 * Selección estandarizada para ballot_positions,
 * incluyendo información relacional relevante del cargo y sus opciones.
 */
const BALLOT_POSITION_SELECT = {
  id: true,
  ballotId: true,
  positionId: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  position: {
    select: {
      id: true,
      electionId: true,
      name: true,
      description: true,
      seats: true,
    },
  },
  ballotOptions: {
    select: {
      id: true,
      optionType: true,
      candidateListId: true,
      label: true,
      orderIndex: true,
    },
    orderBy: {
      orderIndex: 'asc',
    },
  },
};

export const findBallotPositionById = (id) =>
  prisma.ballotPosition.findUnique({
    where: { id },
    select: BALLOT_POSITION_SELECT,
  });

export const findBallotPositionsByBallot = (ballotId) =>
  prisma.ballotPosition.findMany({
    where: {
      ballotId: ballotId,
    },
    select: BALLOT_POSITION_SELECT,
    orderBy: {
      orderIndex: 'asc',
    },
  });

export const countBallotPositionsByBallot = (ballotId) =>
  prisma.ballotPosition.count({
    where: {
      ballotId: ballotId,
    },
  });

export const createBallotPosition = (data) =>
  prisma.ballotPosition.create({
    data,
    select: BALLOT_POSITION_SELECT,
  });

export const updateBallotPosition = (id, data) =>
  prisma.ballotPosition.update({
    where: { id },
    data,
    select: BALLOT_POSITION_SELECT,
  });

export const deleteBallotPositionById = (id) =>
  prisma.ballotPosition.delete({
    where: { id },
    select: {
      id: true,
    },
  });

/**
 * Verifica si una posición ya está incluida
 * dentro de una determinada boleta.
 */
export const findByBallotAndPosition = (
  ballotId,
  positionId,
) =>
  prisma.ballotPosition.findFirst({
    where: {
      ballotId: ballotId,
      positionId: positionId,
    },
    select: BALLOT_POSITION_SELECT,
  });

/**
 * Verifica si un order_index ya está ocupado
 * dentro de una determinada boleta.
 */
export const findByBallotAndOrder = (
  ballotId,
  orderIndex,
) =>
  prisma.ballotPosition.findFirst({
    where: {
      ballotId: ballotId,
      orderIndex: orderIndex,
    },
    select: BALLOT_POSITION_SELECT,
  });

// Nombres cortos que usa ballotPosition.crud.service.js; sin ellos
// listar/crear/editar/borrar cargos de la cédula respondía 500.
export const listByBallot = findBallotPositionsByBallot;
export const create = createBallotPosition;
export const update = updateBallotPosition;
export { deleteBallotPositionById as delete };

export default {
  findBallotPositionById,
  findBallotPositionsByBallot,
  countBallotPositionsByBallot,
  createBallotPosition,
  updateBallotPosition,
  deleteBallotPositionById,
  findByBallotAndPosition,
  findByBallotAndOrder,
};