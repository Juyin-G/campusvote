// src/modules/elections/positions/position.repository.js
// S4-05 — Acceso a datos de cargos vía Prisma.

import { prisma } from '../../../database/prisma.js';

/**
 * IMPORTANTE: Prisma Client usa los nombres de campo en camelCase (definidos en el modelo),
 * NO los nombres mapeados a la BD con @map (snake_case).
 * El modelo se llama 'position' (singular).
 */
const POSITION_SELECT = {
  id: true,
  electionId: true,     // No 'election_id'
  name: true,
  description: true,
  seats: true,
  createdAt: true,      // No 'created_at'
  updatedAt: true,      // No 'updated_at'
};

export const findPositionById = (id) =>
  prisma.position.findUnique({
    where: { id },
    select: POSITION_SELECT,
  });

export const findPositionsByElection = (electionId) =>
  prisma.position.findMany({
    where: { electionId },
    select: POSITION_SELECT,
    orderBy: { name: 'asc' },
  });

/**
 * Cuántos cargos tiene la elección.
 * La usa election.service para impedir programar (DRAFT -> SCHEDULED) una
 * elección sin cargos definidos. Se perdió al reorganizar el módulo en
 * subcarpetas y su ausencia hacía que el cambio de estado respondiera 500.
 */
export const countPositionsByElection = (electionId) =>
  prisma.position.count({
    where: { electionId },
  });

export const countCandidaciesByPosition = (positionId) =>
  prisma.candidacy.count({
    where: { positionId },
  });

export const createPosition = (data) =>
  prisma.position.create({
    data,
    select: POSITION_SELECT,
  });

export const updatePosition = (id, data) =>
  prisma.position.update({
    where: { id },
    data,
    select: POSITION_SELECT,
  });

export const deletePositionById = (id) =>
  prisma.position.delete({
    where: { id },
    select: { id: true },
  });

export default {
  findPositionById,
  findPositionsByElection,
  countCandidaciesByPosition,
  createPosition,
  updatePosition,
  deletePositionById,
};