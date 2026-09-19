// src/modules/fairEvaluations/fairEvaluation.repository.js
// Acceso a datos (Prisma) de la rúbrica CHECKLIST y de las hojas de respuesta.
// Solo traduccíón Prisma ↔ SQL — sin reglas de negocio.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

// ── Selects reutilizables ─────────────────────────────────────────

const CRITERION_SELECT = {
  id: true,
  rubricId: true,
  name: true,
  description: true,
  position: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const DETAIL_SELECT = {
  id: true,
  evaluationId: true,
  criterionId: true,
  rubricId: true,
  checked: true,
  createdAt: true,
  updatedAt: true,
  criterion: {
    select: { id: true, name: true, position: true, isActive: true },
  },
};

const PROJECT_REF = {
  select: { id: true, name: true, fairId: true, status: true },
};

const JURY_REF = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    institutionalId: true,
    role: true,
  },
};

// ── Rúbrica / criterios ──────────────────────────────────────────

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
      criteria: { select: CRITERION_SELECT, orderBy: { position: 'asc' } },
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

// ── Hojas de respuesta (CHECKLIST) ───────────────────────────────

export const findEvaluation = (id, fairId) =>
  prisma.fairEvaluation.findFirst({
    where: { id, fairId },
    select: {
      id: true,
      fairId: true,
      projectId: true,
      juryUserId: true,
      rubricId: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      project: PROJECT_REF,
      jury: JURY_REF,
      details: {
        select: DETAIL_SELECT,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

export const findEvaluationByFairProjectJury = (fairId, projectId, juryUserId) =>
  prisma.fairEvaluation.findFirst({
    where: { fairId, projectId, juryUserId },
    select: { id: true, submittedAt: true, rubricId: true },
  });

// Crea o actualiza la hoja con sus detalles en una sola transacción.
// Si el set ya existe, hace upsert de cada respuesta (checklist).
export const upsertEvaluation = async ({ fairId, projectId, juryUserId, rubricId, responses }) =>
  prisma.$transaction(async (tx) => {
    const set = await tx.fairEvaluation.upsert({
      where: {
        fairId_projectId_juryUserId: { fairId, projectId, juryUserId },
      },
      create: { fairId, projectId, juryUserId, rubricId, submittedAt: null },
      update: {},
      select: { id: true, rubricId: true },
    });

    // upsert por (evaluation_id, criterion_id)
    for (const r of responses) {
      await tx.fairEvaluationDetail.upsert({
        where: {
          evaluationId_criterionId: {
            evaluationId: set.id,
            criterionId: r.criterionId,
          },
        },
        create: {
          evaluationId: set.id,
          criterionId: r.criterionId,
          rubricId,
          checked: Boolean(r.checked),
        },
        update: { checked: Boolean(r.checked) },
        select: { id: true },
      });
    }
    return set;
  });

export const finalizeEvaluation = (id) =>
  prisma.fairEvaluation.update({
    where: { id },
    data: { submittedAt: new Date() },
    select: { id: true, submittedAt: true },
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
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      project: PROJECT_REF,
      jury: JURY_REF,
      details: { select: DETAIL_SELECT, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const countEvaluations = ({ fairId, juryUserId, projectId }) =>
  prisma.fairEvaluation.count({
    where: { fairId, ...(juryUserId ? { juryUserId } : {}), ...(projectId ? { projectId } : {}) },
  });

export const safeCreateEvaluation = async (data, details) => {
  try {
    return await prisma.fairEvaluation.create({
      data: {
        ...data,
        details: {
          create: details.map((d) => ({
            criterionId: d.criterionId,
            rubricId: d.rubricId,
            checked: Boolean(d.checked),
          })),
        },
      },
      select: { id: true },
    });
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
  findEvaluation,
  findEvaluationByFairProjectJury,
  upsertEvaluation,
  finalizeEvaluation,
  listEvaluations,
  countEvaluations,
  safeCreateEvaluation,
};
