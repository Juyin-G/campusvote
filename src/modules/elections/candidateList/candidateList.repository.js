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
  description: true,
  imageUrl: true,     // No 'image_url'
  category: true,
  tags: true,
  createdAt: true,    // No 'created_at'
  updatedAt: true,    // No 'updated_at'
};

/**
 * Filtros de búsqueda por proyecto (ferias/concursos):
 * - search: coincidencia parcial insensible a mayúsculas en nombre/acrónimo/descripción
 * - category: categoría exacta
 * - status: estado de la candidatura (PENDING/APPROVED/REJECTED) al menos una
 */
const buildCandidateListWhere = (electionId, { search, category, status, fromDate, toDate } = {}) => {
  const where = { electionId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { acronym: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;
  if (status) where.candidacies = { some: { status } };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  return where;
};

// El orden por rating no puede resolverse en SQL puro (promedio agregado de una
// relación), así que 'rating' se ordena en el service tras adjuntar el resumen.
const buildCandidateListOrderBy = (sortBy = 'name') => {
  if (sortBy === 'createdAt') return [{ createdAt: 'desc' }];
  return [{ name: 'asc' }];
};

export const findCandidateListById = (id) =>
  prisma.candidateList.findUnique({
    where: { id },
    select: CANDIDATE_LIST_SELECT,
  });

/** Las listas/proyectos de una elección, con filtros de búsqueda opcionales. */
export const findCandidateListsByElection = (electionId, filters = {}) =>
  prisma.candidateList.findMany({
    where: buildCandidateListWhere(electionId, filters),
    select: CANDIDATE_LIST_SELECT,
    orderBy: buildCandidateListOrderBy(filters.sortBy),
  });

export const countCandidateListsByElection = (electionId, filters = {}) =>
  prisma.candidateList.count({
    where: buildCandidateListWhere(electionId, filters),
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