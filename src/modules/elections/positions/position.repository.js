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