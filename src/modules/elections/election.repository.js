// src/modules/elections/election.repository.js
// S4-02 — Acceso a datos de elecciones (Prisma) + función SQL de certificación.

import { prisma } from '../../database/prisma.js';

// El modelo Prisma `elections` expone los campos en snake_case sin @map.
const ELECTION_SELECT = {
  id: true,
  title: true,
  description: true,
  process_type: true,
  election_type: true,
  period_id: true,
  faculty_id: true,
  program_id: true,
  start_at: true,
  end_at: true,
  status: true,
  created_by: true,
  form_structure: true,
  is_anonymous_allowed: true,
  created_at: true,
  updated_at: true,
};

const buildElectionWhere = ({
  status,
  election_type,
  period_id,
  faculty_id,
  program_id,
  search,
} = {}) => {
  const where = {};

  if (status) where.status = status;
  if (election_type) where.election_type = election_type;
  if (period_id) where.period_id = period_id;
  if (faculty_id) where.faculty_id = faculty_id;
  if (program_id) where.program_id = program_id;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

export const findElectionById = (id) =>
  prisma.elections.findUnique({
    where: { id },
    select: ELECTION_SELECT,
  });

/** Solo el estado: para validar transiciones sin traer toda la fila. */
export const findElectionStatus = (id) =>
  prisma.elections.findUnique({
    where: { id },
    select: { id: true, status: true, start_at: true, end_at: true },
  });

export const listElections = ({ skip = 0, take = 10, ...filters } = {}) =>
  prisma.elections.findMany({
    where: buildElectionWhere(filters),
    select: ELECTION_SELECT,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });

export const countElections = (filters = {}) =>
  prisma.elections.count({
    where: buildElectionWhere(filters),
  });

export const createElection = (data) =>
  prisma.elections.create({
    data,
    select: ELECTION_SELECT,
  });

export const updateElection = (id, data) =>
  prisma.elections.update({
    where: { id },
    data,
    select: ELECTION_SELECT,
  });

export const updateElectionStatus = (id, status) =>
  prisma.elections.update({
    where: { id },
    data: { status },
    select: ELECTION_SELECT,
  });

export const deleteElectionById = (id) =>
  prisma.elections.delete({
    where: { id },
    select: { id: true },
  });

/**
 * Certificación: delega en la función SQL nativa certify_election(),
 * que valida que la elección esté CLOSED, calcula el escrutinio y
 * deja el estado en CERTIFIED dentro de una sola transacción.
 */
export const certifyElection = async (electionId) => {
  await prisma.$queryRaw`SELECT certify_election(${electionId}::uuid)`;
  return findElectionById(electionId);
};

export default {
  findElectionById,
  findElectionStatus,
  listElections,
  countElections,
  createElection,
  updateElection,
  updateElectionStatus,
  deleteElectionById,
  certifyElection,
};
