// src/modules/elections/elections/election.repository.js

import { prisma } from '../../../database/prisma.js'; // Ajusta la ruta si es necesario


const ELECTION_SELECT = {
  id: true,
  title: true,
  description: true,
  processType: true,      // No 'process_type'
  scopeType: true,        // No 'election_type'
  periodId: true,         // No 'period_id'
  facultyId: true,        // No 'faculty_id'
  programId: true,        // No 'program_id'
  startAt: true,          // No 'start_at'
  endAt: true,            // No 'end_at'
  status: true,
  createdBy: true,        // No 'created_by'
  formStructure: true,    // No 'form_structure'
  isAnonymousAllowed: true, // No 'is_anonymous_allowed'
  createdAt: true,        // No 'created_at'
  updatedAt: true,        // No 'updated_at'
};

const buildElectionWhere = ({
  status,
  scopeType,      // Recibe camelCase desde el service
  periodId,
  facultyId,
  programId,
  search,
} = {}) => {
  const where = {};

  if (status) where.status = status;
  if (scopeType) where.scopeType = scopeType;
  if (periodId) where.periodId = periodId;
  if (facultyId) where.facultyId = facultyId;
  if (programId) where.programId = programId;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

export const findElectionById = (id) =>
  prisma.election.findUnique({
    where: { id },
    select: ELECTION_SELECT,
  });

/** Solo el estado y fechas: para validar transiciones sin traer toda la fila. */
export const findElectionStatus = (id) =>
  prisma.election.findUnique({
    where: { id },
    select: { id: true, status: true, startAt: true, endAt: true },
  });

export const listElections = ({ skip = 0, take = 10, ...filters } = {}) =>
  prisma.election.findMany({
    where: buildElectionWhere(filters),
    select: ELECTION_SELECT,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const countElections = (filters = {}) =>
  prisma.election.count({
    where: buildElectionWhere(filters),
  });

export const createElection = (data) =>
  prisma.election.create({
    data,
    select: ELECTION_SELECT,
  });

export const updateElection = (id, data) =>
  prisma.election.update({
    where: { id },
    data,
    select: ELECTION_SELECT,
  });

export const updateElectionStatus = (id, status) =>
  prisma.election.update({
    where: { id },
    data: { status },
    select: ELECTION_SELECT,
  });

export const deleteElectionById = (id) =>
  prisma.election.delete({
    where: { id },
    select: { id: true },
  });

/**
 * Certificación: delega en la función SQL nativa certify_election(),
 * que valida que la elección esté CLOSED, calcula el escrutinio y
 * deja el estado en CERTIFIED dentro de una sola transacción.
 */
export const certifyElection = async (electionId) => {
  // Prisma ejecuta esto de forma segura, previniendo inyección SQL
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