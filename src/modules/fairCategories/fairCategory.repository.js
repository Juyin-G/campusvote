// src/modules/fairCategories/fairCategory.repository.js
// Acceso a datos (Prisma) de categorías de ferias.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const CATEGORY_SELECT = {
  id: true,
  fairId: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const handlePrismaError = (error, { unique = 'FAIR_CATEGORY_DUPLICATE' } = {}) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error(unique);
  }
  throw error;
};

export const findById = (id, fairId) =>
  prisma.fairCategory.findFirst({ where: { id, fairId }, select: CATEGORY_SELECT });

export const findByFair = (fairId) =>
  prisma.fairCategory.findMany({
    where: { fairId },
    select: CATEGORY_SELECT,
    orderBy: { name: 'asc' },
  });

export const create = async (data) => {
  try {
    return await prisma.fairCategory.create({ data, select: CATEGORY_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.fairCategory.update({ where: { id }, data, select: CATEGORY_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const remove = (id) =>
  prisma.fairCategory.delete({ where: { id }, select: CATEGORY_SELECT });

export const countProjects = (categoryId) =>
  prisma.project.count({ where: { categoryId } });

export default {
  findById,
  findByFair,
  create,
  update,
  remove,
  countProjects,
};