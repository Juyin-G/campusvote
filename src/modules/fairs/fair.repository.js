// src/modules/fairs/fair.repository.js
// Acceso a datos (Prisma) de ferias académicas.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const FAIR_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  status: true,
  startsAt: true,
  endsAt: true,
  siteId: true,
  site: {
    select: { id: true, name: true, address: true, city: true },
  },
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { projects: true },
  },
};

const handlePrismaError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return null;
    if (error.code === 'P2002') throw new Error('FAIR_UNIQUE_CONSTRAINT');
    if (error.code === 'P2003') throw new Error('FAIR_FOREIGN_KEY');
  }
  throw error;
};

export const findById = (id) =>
  prisma.fair.findUnique({
    where: { id },
    select: FAIR_SELECT,
  });

export const list = ({ where = {}, skip = 0, take = 20 } = {}) =>
  prisma.fair.findMany({
    where,
    select: FAIR_SELECT,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const count = (where = {}) => prisma.fair.count({ where });

export const create = async (data) => {
  try {
    return await prisma.fair.create({
      data,
      select: FAIR_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.fair.update({
      where: { id },
      data,
      select: FAIR_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export default {
  findById,
  list,
  count,
  create,
  update,
};