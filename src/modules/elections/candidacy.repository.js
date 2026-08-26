// src/modules/elections/candidacy.repository.js
// S4-09 — Acceso a datos de candidaturas vía Prisma.

import { prisma } from '../../database/prisma.js';

/**
 * Se incluye un resumen del usuario candidato: sin él, un listado de
 * candidaturas solo devolvería UUIDs y sería inservible para la papeleta.
 * El modelo User usa camelCase con @map, así que el service lo pasa a
 * snake_case antes de responder.
 */
const CANDIDACY_SELECT = {
  id: true,
  election_id: true,
  candidate_list_id: true,
  position_id: true,
  user_id: true,
  order_index: true,
  is_principal: true,
  created_at: true,
  updated_at: true,
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

const buildCandidacyWhere = (electionId, { candidate_list_id, position_id } = {}) => {
  const where = { election_id: electionId };

  if (candidate_list_id) where.candidate_list_id = candidate_list_id;
  if (position_id) where.position_id = position_id;

  return where;
};

export const findCandidacyById = (id) =>
  prisma.candidacies.findUnique({
    where: { id },
    select: CANDIDACY_SELECT,
  });

/** Candidaturas de una elección, ordenadas como aparecerán en la papeleta. */
export const findCandidaciesByElection = (electionId, filters = {}) =>
  prisma.candidacies.findMany({
    where: buildCandidacyWhere(electionId, filters),
    select: CANDIDACY_SELECT,
    orderBy: [{ candidate_list_id: 'asc' }, { order_index: 'asc' }],
  });

export const countCandidaciesByElection = (electionId, filters = {}) =>
  prisma.candidacies.count({
    where: buildCandidacyWhere(electionId, filters),
  });

/** Comprobación previa de uq_candidacies_election_user. */
export const findCandidacyByElectionAndUser = (electionId, userId) =>
  prisma.candidacies.findFirst({
    where: { election_id: electionId, user_id: userId },
    select: { id: true, candidate_list_id: true },
  });

export const createCandidacy = (data) =>
  prisma.candidacies.create({
    data,
    select: CANDIDACY_SELECT,
  });

export const updateCandidacy = (id, data) =>
  prisma.candidacies.update({
    where: { id },
    data,
    select: CANDIDACY_SELECT,
  });

export const deleteCandidacyById = (id) =>
  prisma.candidacies.delete({
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
