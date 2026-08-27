// src/modules/elections/candidacy/candidacy.repository.js

import { prisma } from '../../../database/prisma.js';

/**
 * Se incluye un resumen del usuario candidato y el nuevo campo 'status'.
 * IMPORTANTE: Prisma Client usa los nombres de campo en camelCase (definidos en el modelo),
 * NO los nombres mapeados a la BD con @map (snake_case).
 */
const CANDIDACY_SELECT = {
  id: true,
  electionId: true,
  candidateListId: true,
  positionId: true,
  userId: true,
  status: true, // <-- CAMPO AGREGADO (necesario para que el service lo formatee)
  orderIndex: true,
  isPrincipal: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      institutionalId: true,
    },
  },
};

const buildCandidacyWhere = (electionId, { candidateListId, positionId } = {}) => {
  const where = { electionId };

  if (candidateListId) where.candidateListId = candidateListId;
  if (positionId) where.positionId = positionId;

  return where;
};

export const findCandidacyById = (id) =>
  prisma.candidacy.findUnique({ // 'candidacy' en singular (nombre del modelo)
    where: { id },
    select: CANDIDACY_SELECT,
  });

/** Candidaturas de una elección, ordenadas como aparecerán en la papeleta. */
export const findCandidaciesByElection = (electionId, filters = {}) =>
  prisma.candidacy.findMany({
    where: buildCandidacyWhere(electionId, filters),
    select: CANDIDACY_SELECT,
    orderBy: [{ candidateListId: 'asc' }, { orderIndex: 'asc' }],
  });

export const countCandidaciesByElection = (electionId, filters = {}) =>
  prisma.candidacy.count({
    where: buildCandidacyWhere(electionId, filters),
  });

/** Comprobación previa de uq_candidacies_election_user. */
export const findCandidacyByElectionAndUser = (electionId, userId) =>
  prisma.candidacy.findFirst({
    where: { electionId, userId },
    select: { id: true, candidateListId: true },
  });

export const createCandidacy = (data) =>
  prisma.candidacy.create({
    data,
    select: CANDIDACY_SELECT,
  });

export const updateCandidacy = (id, data) =>
  prisma.candidacy.update({
    where: { id },
    data,
    select: CANDIDACY_SELECT,
  });

export const deleteCandidacyById = (id) =>
  prisma.candidacy.delete({
    where: { id },
    select: { id: true },
  });

export default {
  findCandidacyById,
  findCandidaciesByElection,
  countCandidaciesByElection,
  findCandidacyByElectionAndUser,
  createCandidacy,
  updateCandidacy,
  deleteCandidacyById,
};