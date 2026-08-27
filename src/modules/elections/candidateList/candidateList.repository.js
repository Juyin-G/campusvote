// src/modules/elections/candidateList/candidateList.repository.js
// S4-07 — Acceso a datos de listas candidatas vía Prisma.

import { prisma } from '../../../database/prisma.js'; // Ajusta la ruta si es necesario

/**
 * IMPORTANTE: Prisma Client usa los nombres de campo en camelCase (definidos en el modelo),
 * NO los nombres mapeados a la BD con @map (snake_case).
 * El modelo se llama 'candidateList' (singular), aunque la tabla sea 'candidate_lists'.
 */
const CANDIDATE_LIST_SELECT = {
  id: true,
  electionId: true,   // No 'election_id'
  name: true,
  acronym: true,
  motto: true,
  logo: true,
  createdAt: true,    // No 'created_at'
  updatedAt: true,    // No 'updated_at'
};

export const findCandidateListById = (id) =>
  prisma.candidateList.findUnique({
    where: { id },
    select: CANDIDATE_LIST_SELECT,
  });

/** Las listas de una elección, ordenadas por nombre. */
export const findCandidateListsByElection = (electionId) =>
  prisma.candidateList.findMany({
    where: { electionId },
    select: CANDIDATE_LIST_SELECT,
    orderBy: { name: 'asc' },
  });

export const countCandidateListsByElection = (electionId) =>
  prisma.candidateList.count({
    where: { electionId },
  });

export const createCandidateList = (data) =>
  prisma.candidateList.create({
    data,
    select: CANDIDATE_LIST_SELECT,
  });

export const updateCandidateList = (id, data) =>
  prisma.candidateList.update({
    where: { id },
    data,
    select: CANDIDATE_LIST_SELECT,
  });

export const deleteCandidateListById = (id) =>
  prisma.candidateList.delete({
    where: { id },
    select: { id: true },
  });

/**
 * Cuántas candidaturas cuelgan de la lista.
 * La FK de candidacies es ON DELETE CASCADE, así que borrar la lista
 * arrastraría a sus integrantes sin previo aviso.
 */
export const countCandidaciesByList = (candidateListId) =>
  prisma.candidacy.count({ // 'candidacy' en singular
    where: { candidateListId }, // camelCase
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