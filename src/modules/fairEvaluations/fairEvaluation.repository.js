// src/modules/fairEvaluations/fairEvaluation.repository.js
// Acceso a datos (Prisma) de rúbricas y evaluaciones de ferias.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

// ── Rúbrica / criterios ────────────────────────────────────────────

const CRITERION_SELECT = {
  id: true,
  rubricId: true,
  name: true,
  description: true,
  minScore: true,
  maxScore: true,
  position: true,
  createdAt: true,
  updatedAt: true,
};

export const findRubricByFair = (fairId) =>
  prisma.fairRubric.findUnique({
    where: { fairId },
    select: {
      id: true,
      fairId: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      criteria: {
        select: CRITERION_SELECT,
        orderBy: { position: 'asc' },
      },
    },
  });

export const createRubric = (data) =>
  prisma.fairRubric.create({ data, select: { id: true, fairId: true } });

export const updateRubric = (fairId, data) =>
  prisma.fairRubric.update({ where: { fairId }, data });

export const createCriterion = (data) =>
  prisma.rubricCriterion.create({ data, select: CRITERION_SELECT });

export const findCriterion = (id, rubricId) =>
  prisma.rubricCriterion.findFirst({
    where: { id, rubricId },
    select: CRITERION_SELECT,
  });

export const updateCriterion = (id, data) =>
  prisma.rubricCriterion.update({ where: { id }, data, select: CRITERION_SELECT });

export const deleteCriterion = (id) =>
  prisma.rubricCriterion.delete({ where: { id } });

export const nextCriterionPosition = async (rubricId) => {
  const last = await prisma.rubricCriterion.findFirst({
    where: { rubricId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
};

export const countCriteria = (rubricId) =>
  prisma.rubricCriterion.count({ where: { rubricId } });

// ── Declaración de jurado ──────────────────────────────────────────

const DECLARATION_SELECT = {
  id: true,
  fairId: true,
  juryUserId: true,
  statement: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
};

export const findDeclaration = (fairId, juryUserId) =>
  prisma.fairJuryDeclaration.findFirst({
    where: { fairId, juryUserId },
    select: DECLARATION_SELECT,
  });

export const createDeclaration = (data) =>
  prisma.fairJuryDeclaration.create({ data, select: DECLARATION_SELECT });

export const safeCreateDeclaration = async (data) => {
  try {
    return await createDeclaration(data);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('FAIR_JURY_DECLARATION_ALREADY_EXISTS');
    }
    throw error;
  }
};

// ── Evaluaciones ────────────────────────────────────────────────────

const PROJECT_REF = {
  select: {
    id: true,
    name: true,
    description: true,
    status: true,
    fairId: true,
    createdBy: {
      select: { id: true, firstName: true, lastName: true },
    },
  },
};

const JURY_REF = {
  select: { id: true, firstName: true, lastName: true, institutionalId: true, role: true },
};

const DETAIL_REF = {
  select: {
    id: true,
    criterionId: true,
    score: true,
    criterion: {
      select: { id: true, name: true, minScore: true, maxScore: true, position: true },
    },
  },
  orderBy: { createdAt: 'asc' },
};

export const findEvaluation = (id, fairId) =>
  prisma.fairEvaluation.findFirst({
    where: { id, fairId },
    select: {
      id: true,
      fairId: true,
      projectId: true,
      juryUserId: true,
      rubricId: true,
      totalScore: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      project: PROJECT_REF,
      jury: JURY_REF,
      details: DETAIL_REF,
    },
  });

export const findEvaluationByFairProjectJury = (fairId, projectId, juryUserId) =>
  prisma.fairEvaluation.findFirst({
    where: { fairId, projectId, juryUserId },
    select: { id: true },
  });

export const createEvaluation = (data, details) =>
  prisma.fairEvaluation.create({
    data: {
      ...data,
      details: {
        create: details.map((d) => ({
          criterionId: d.criterionId,
          rubricId: d.rubricId,
          score: d.score,
        })),
      },
    },
    select: { id: true },
  });

export const updateEvaluation = async (id, data, details) =>
  prisma.$transaction(async (tx) => {
    await tx.fairEvaluationDetail.deleteMany({ where: { evaluationId: id } });
    await tx.fairEvaluationDetail.createMany({
      data: details.map((d) => ({
        evaluationId: id,
        criterionId: d.criterionId,
        rubricId: d.rubricId,
        score: d.score,
      })),
    });
    return tx.fairEvaluation.update({ where: { id }, data });
  });

export const listEvaluations = ({ fairId, juryUserId, projectId, skip = 0, take = 20 }) =>
  prisma.fairEvaluation.findMany({
    where: {
      fairId,
      ...(juryUserId ? { juryUserId } : {}),
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      fairId: true,
      projectId: true,
      juryUserId: true,
      rubricId: true,
      totalScore: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      project: PROJECT_REF,
      jury: JURY_REF,
      details: DETAIL_REF,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const countEvaluations = ({ fairId, juryUserId, projectId }) =>
  prisma.fairEvaluation.count({
    where: {
      fairId,
      ...(juryUserId ? { juryUserId } : {}),
      ...(projectId ? { projectId } : {}),
    },
  });

const handlePrismaError = (error, { unique = 'FAIR_EVALUATION_UNIQUE_CONSTRAINT' } = {}) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error(unique);
  }
  throw error;
};

export const safeCreateEvaluation = async (data, details) => {
  try {
    return await createEvaluation(data, details);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('FAIR_EVALUATION_ALREADY_EXISTS');
    }
    throw error;
  }
};

export default {
  findRubricByFair,
  createRubric,
  updateRubric,
  createCriterion,
  findCriterion,
  updateCriterion,
  deleteCriterion,
  nextCriterionPosition,
  countCriteria,
  findDeclaration,
  createDeclaration,
  safeCreateDeclaration,
  findEvaluation,
  findEvaluationByFairProjectJury,
  createEvaluation,
  safeCreateEvaluation,
  updateEvaluation,
  listEvaluations,
  countEvaluations,
  handlePrismaError,
};