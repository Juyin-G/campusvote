// src/modules/ratings/juryAssignment.repository.js
// Acceso a datos para asignación de jurados a proyectos.

import { prisma } from '../../database/prisma.js';

export const ASSIGNMENT_SELECT = {
  id: true,
  electionId: true,
  candidacyId: true,
  juryId: true,
  status: true,
  isDiriment: true,
  conflictDeclaration: true,
  declaredAt: true,
  assignedBy: true,
  createdAt: true,
  updatedAt: true,
};

export const createAssignment = ({ electionId, candidacyId, juryId, isDiriment, assignedBy }) =>
  prisma.juryAssignment.create({
    data: { electionId, candidacyId, juryId, isDiriment, assignedBy },
    select: ASSIGNMENT_SELECT,
  });

export const findAssignment = (assignmentId) =>
  prisma.juryAssignment.findUnique({
    where: { id: assignmentId },
    select: ASSIGNMENT_SELECT,
  });

export const findAssignmentByElection = (electionId, assignmentId) =>
  prisma.juryAssignment.findFirst({
    where: { id: assignmentId, electionId },
    select: ASSIGNMENT_SELECT,
  });

export const updateAssignment = (assignmentId, data) =>
  prisma.juryAssignment.update({
    where: { id: assignmentId },
    data,
    select: ASSIGNMENT_SELECT,
  });

export const listAssignments = ({ electionId, candidacyId, status, juryId }) =>
  prisma.juryAssignment.findMany({
    where: {
      electionId,
      ...(candidacyId ? { candidacyId } : {}),
      ...(status ? { status } : {}),
      ...(juryId ? { juryId } : {}),
    },
    select: {
      ...ASSIGNMENT_SELECT,
      juror: { select: { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true } },
      candidacy: {
        select: {
          id: true,
          candidateList: { select: { id: true, name: true, acronym: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

export default {
  createAssignment,
  findAssignment,
  findAssignmentByElection,
  updateAssignment,
  listAssignments,
};