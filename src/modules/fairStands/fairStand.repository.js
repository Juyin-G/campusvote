// src/modules/fairStands/fairStand.repository.js
// Acceso a datos (Prisma) de stands/cabinas de ferias.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const STAND_SELECT = {
  id: true,
  fairId: true,
  code: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const handlePrismaError = (error, { unique = 'FAIR_STAND_DUPLICATE' } = {}) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error(unique);
  }
  throw error;
};

export const findById = (id, fairId) =>
  prisma.fairStand.findFirst({ where: { id, fairId }, select: STAND_SELECT });

export const findByFair = (fairId) =>
  prisma.fairStand.findMany({
    where: { fairId },
    select: STAND_SELECT,
    orderBy: { code: 'asc' },
  });

export const create = async (data) => {
  try {
    return await prisma.fairStand.create({ data, select: STAND_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.fairStand.update({ where: { id }, data, select: STAND_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const remove = (id) =>
  prisma.fairStand.delete({ where: { id }, select: STAND_SELECT });

export const countProjects = (standId) =>
  prisma.project.count({ where: { standId } });

export default {
  findById,
  findByFair,
  create,
  update,
  remove,
  countProjects,
};