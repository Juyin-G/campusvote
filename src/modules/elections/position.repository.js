// src/modules/elections/position.repository.js
// S4-05 — Acceso a datos de cargos (positions) vía Prisma.

import { prisma } from '../../database/prisma.js';

// El modelo Prisma `positions` expone los campos en snake_case sin @map.
const POSITION_SELECT = {
  id: true,
  election_id: true,
  name: true,
  description: true,
  seats: true,
  created_at: true,
  updated_at: true,
};

export const findPositionById = (id) =>
  prisma.positions.findUnique({
    where: { id },
    select: POSITION_SELECT,
  });

/** Los cargos de una elección, ordenados por nombre. */
export const findPositionsByElection = (electionId) =>
  prisma.positions.findMany({
    where: { election_id: electionId },
    select: POSITION_SELECT,
    orderBy: { name: 'asc' },
  });

export const countPositionsByElection = (electionId) =>
  prisma.positions.count({
    where: { election_id: electionId },
  });

export const createPosition = (data) =>
  prisma.positions.create({
    data,
    select: POSITION_SELECT,
  });

export const updatePosition = (id, data) =>
  prisma.positions.update({
    where: { id },
    data,
    select: POSITION_SELECT,
  });

export const deletePositionById = (id) =>
  prisma.positions.delete({
    where: { id },
    select: { id: true },
  });

/**
 * Cuántas candidaturas cuelgan del cargo.
 * Sirve para no borrar en silencio: la FK de candidacies es ON DELETE CASCADE,
 * así que borrar el cargo se llevaría por delante sus candidaturas.
 */
export const countCandidaciesByPosition = (positionId) =>
  prisma.candidacies.count({
    where: { position_id: positionId },
  });

export default {
  findPositionById,
  findPositionsByElection,
  countPositionsByElection,
  createPosition,
  updatePosition,
  deletePositionById,
  countCandidaciesByPosition,
};
