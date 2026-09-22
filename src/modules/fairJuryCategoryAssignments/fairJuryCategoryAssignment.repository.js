// src/modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.repository.js
// Acceso a datos (Prisma) de asignaciones JURY → CATEGORY.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const ASSIGNMENT_SELECT = {
  id: true,
  juryAssignmentId: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, fairId: true, name: true, description: true },
  },
  juryAssignment: {
    select: { id: true, fairId: true, userId: true },
  },
};

const handlePrismaError = (error, { unique = 'FAIR_JURY_CATEGORY_DUPLICATE' } = {}) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error(unique);
    if (error.code === 'P2003') throw new Error('FAIR_JURY_CATEGORY_FOREIGN_KEY');
  }
  throw error;
};

export const findByJuryAssignmentAndCategory = (juryAssignmentId, categoryId) =>
  prisma.fairJuryCategoryAssignment.findFirst({
    where: { juryAssignmentId, categoryId },
    select: ASSIGNMENT_SELECT,
  });

export const listByJuryAssignment = (juryAssignmentId) =>
  prisma.fairJuryCategoryAssignment.findMany({
    where: { juryAssignmentId },
    select: ASSIGNMENT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

export const listByFairAndUser = (fairId, userId) =>
  prisma.fairJuryCategoryAssignment.findMany({
    where: {
      juryAssignment: { fairId, userId },
    },
    select: ASSIGNMENT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

export const countByCategory = (categoryId) =>
  prisma.fairJuryCategoryAssignment.count({ where: { categoryId } });

export const create = async (data) => {
  try {
    return await prisma.fairJuryCategoryAssignment.create({
      data,
      select: ASSIGNMENT_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const remove = (juryAssignmentId, categoryId) =>
  prisma.fairJuryCategoryAssignment.deleteMany({
    where: { juryAssignmentId, categoryId },
  });

export default {
  findByJuryAssignmentAndCategory,
  listByJuryAssignment,
  listByFairAndUser,
  countByCategory,
  create,
  remove,
};
