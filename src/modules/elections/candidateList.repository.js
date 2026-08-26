// src/modules/elections/candidateList.repository.js
// S4-07 — Acceso a datos de listas candidatas vía Prisma.

import { prisma } from '../../database/prisma.js';

// El modelo Prisma `candidate_lists` expone los campos en snake_case sin @map.
const CANDIDATE_LIST_SELECT = {
  id: true,
  election_id: true,
  name: true,
  acronym: true,
  motto: true,
  logo: true,
  created_at: true,
  updated_at: true,
};

export const findCandidateListById = (id) =>
  prisma.candidate_lists.findUnique({
    where: { id },
    select: CANDIDATE_LIST_SELECT,
  });

/** Las listas de una elección, ordenadas por nombre. */
export const findCandidateListsByElection = (electionId) =>
  prisma.candidate_lists.findMany({
    where: { election_id: electionId },
    select: CANDIDATE_LIST_SELECT,
    orderBy: { name: 'asc' },
  });

export const countCandidateListsByElection = (electionId) =>
  prisma.candidate_lists.count({
    where: { election_id: electionId },
  });

export const createCandidateList = (data) =>
  prisma.candidate_lists.create({
    data,
    select: CANDIDATE_LIST_SELECT,
  });

export const updateCandidateList = (id, data) =>
  prisma.candidate_lists.update({
    where: { id },
    data,
    select: CANDIDATE_LIST_SELECT,
  });

export const deleteCandidateListById = (id) =>
  prisma.candidate_lists.delete({
    where: { id },
    select: { id: true },
  });

/**
 * Cuántas candidaturas cuelgan de la lista.
 * La FK de candidacies es ON DELETE CASCADE, así que borrar la lista
 * arrastraría a sus integrantes sin previo aviso.
 */
export const countCandidaciesByList = (candidateListId) =>
  prisma.candidacies.count({
    where: { candidate_list_id: candidateListId },
  });

export default {
  findCandidateListById,
  findCandidateListsByElection,
  countCandidateListsByElection,
  createCandidateList,
  updateCandidateList,
  deleteCandidateListById,
  countCandidaciesByList,
};
