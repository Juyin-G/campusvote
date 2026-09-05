// src/modules/objections/objection.repository.js

import { prisma } from '../../database/prisma.js';

const PUBLIC_SELECT = {
  id: true,
  electionId: true,
  candidateListId: true,
  candidacyId: true,
  objectionType: true,
  reason: true,
  evidenceUrls: true,
  filedBy: true,
  status: true,
  resolutionNotes: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
};

export const createObjection = (data) =>
  prisma.candidacyObjection.create({ data, select: PUBLIC_SELECT });

export const findObjection = (id) =>
  prisma.candidacyObjection.findUnique({ where: { id }, select: PUBLIC_SELECT });

export const findObjectionInElection = (electionId, id) =>
  prisma.candidacyObjection.findFirst({
    where: { id, electionId },
    select: PUBLIC_SELECT,
  });

export const resolveObjection = (id, data) =>
  prisma.candidacyObjection.update({ where: { id }, data, select: PUBLIC_SELECT });

export const listObjections = ({ electionId, status, objectionType, skip = 0, take = 50 }) =>
  prisma.candidacyObjection.findMany({
    where: {
      electionId,
      ...(status ? { status } : {}),
      ...(objectionType ? { objectionType } : {}),
    },
    select: {
      ...PUBLIC_SELECT,
      filer: { select: { id: true, firstName: true, lastName: true, documentType: true } },
      candidateList: { select: { id: true, name: true, acronym: true } },
      candidacy: { select: { id: true, candidateList: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const countObjections = ({ electionId, status, objectionType }) =>
  prisma.candidacyObjection.count({
    where: {
      electionId,
      ...(status ? { status } : {}),
      ...(objectionType ? { objectionType } : {}),
    },
  });

export const countPendingObjections = (electionId) =>
  prisma.candidacyObjection.count({ where: { electionId, status: 'PENDING' } });

export default {
  createObjection,
  findObjection,
  findObjectionInElection,
  resolveObjection,
  listObjections,
  countObjections,
  countPendingObjections,
};