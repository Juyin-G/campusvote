// src/modules/ballots/ballotPosition.repository.js
// S5-04 — Acceso a datos de ballot_positions vía Prisma.

import { prisma } from '../../../database/prisma.js';

/**
 * Selección estandarizada para ballot_positions,
 * incluyendo información relacional relevante del cargo y sus opciones.
 */
const BALLOT_POSITION_SELECT = {
  id: true,
  ballot_id: true,
  position_id: true,
  order_index: true,
  created_at: true,
  updated_at: true,
  position: {
    select: {
      id: true,
      election_id: true,
      name: true,
      description: true,
      max_selectable_options: true,
    },
  },
  options: {
    select: {
      id: true,
      option_type: true,
      candidate_list_id: true,
      label: true,
      order_index: true,
    },
    orderBy: {
      order_index: 'asc',
    },
  },
};

export const findBallotPositionById = (id) =>
  prisma.ballot_positions.findUnique({
    where: { id },
    select: BALLOT_POSITION_SELECT,
  });

export const findBallotPositionsByBallot = (ballotId) =>
  prisma.ballot_positions.findMany({
    where: {
      ballot_id: ballotId,
    },
    select: BALLOT_POSITION_SELECT,
    orderBy: {
      order_index: 'asc',
    },
  });

export const countBallotPositionsByBallot = (ballotId) =>
  prisma.ballot_positions.count({
    where: {
      ballot_id: ballotId,
    },
  });

export const createBallotPosition = (data) =>
  prisma.ballot_positions.create({
    data,
    select: BALLOT_POSITION_SELECT,
  });

export const updateBallotPosition = (id, data) =>
  prisma.ballot_positions.update({
    where: { id },
    data,
    select: BALLOT_POSITION_SELECT,
  });

export const deleteBallotPositionById = (id) =>
  prisma.ballot_positions.delete({
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
  prisma.ballot_positions.findFirst({
    where: {
      ballot_id: ballotId,
      position_id: positionId,
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
  prisma.ballot_positions.findFirst({
    where: {
      ballot_id: ballotId,
      order_index: orderIndex,
    },
    select: BALLOT_POSITION_SELECT,
  });

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