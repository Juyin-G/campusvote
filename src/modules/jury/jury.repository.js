import { prisma } from '../../database/prisma.js';

export const findAssignment = ({ electionId, candidacyId, jurorId }) =>
  prisma.juryAssignment.findUnique({
    where: { candidacyId_jurorId: { candidacyId, jurorId } },
    select: { id: true, electionId: true, candidacyId: true, jurorId: true, status: true },
  });

export const listAssignments = (electionId, jurorId) =>
  prisma.juryAssignment.findMany({
    where: { electionId, ...(jurorId ? { jurorId } : {}), status: 'ACTIVE' },
    include: {
      juror: { select: { id: true, firstName: true, lastName: true, email: true } },
      candidacy: { include: { candidateList: { select: { id: true, name: true, acronym: true } } } },
    },
    orderBy: { assignedAt: 'asc' },
  });

export const createAssignment = (data) =>
  prisma.juryAssignment.create({
    data,
    include: { juror: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

export const revokeAssignment = (id) =>
  prisma.juryAssignment.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

export const findConflict = ({ electionId, candidacyId, jurorId }) =>
  prisma.juryConflict.findUnique({
    where: { electionId_candidacyId_jurorId: { electionId, candidacyId, jurorId } },
  });

export const declareConflict = (data) =>
  prisma.juryConflict.upsert({
    where: {
      electionId_candidacyId_jurorId: {
        electionId: data.electionId,
        candidacyId: data.candidacyId,
        jurorId: data.jurorId,
      },
    },
    create: data,
    update: { reason: data.reason, status: 'OPEN', declaredBy: data.declaredBy, resolvedBy: null, resolvedAt: null },
  });

export const clearConflict = (id, resolvedBy) =>
  prisma.juryConflict.update({
    where: { id },
    data: { status: 'CLEARED', resolvedBy, resolvedAt: new Date() },
  });
