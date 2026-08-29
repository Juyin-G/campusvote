import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PERIOD_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const findById = (id) => 
  prisma.academicPeriod.findUnique({ where: { id }, select: PERIOD_SELECT });

export const list = ({ skip = 0, take = 50 } = {}) => 
  prisma.academicPeriod.findMany({ 
    select: PERIOD_SELECT, 
    orderBy: { startDate: 'desc' }, 
    skip, 
    take 
  });

export const count = () => prisma.academicPeriod.count();

export const checkOverlap = async (startDate, endDate, excludeId = null) => {
  const where = {
    isActive: true,
    AND: [
      { startDate: { lte: endDate } },
      { endDate: { gte: startDate } },
    ],
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.academicPeriod.findFirst({
    where,
    select: { id: true, name: true, startDate: true, endDate: true },
  });
};

export const hasAssociatedRegistries = async (periodId) => {
  const count = await prisma.voterRegistry.count({
    where: { periodId },
  });
  return count > 0;
};

export const create = (data) => 
  prisma.academicPeriod.create({ data, select: PERIOD_SELECT });

export const update = async (id, data) => {
  try {
    return await prisma.academicPeriod.update({ where: { id }, data, select: PERIOD_SELECT });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const setActive = async (id) => {
  return prisma.$transaction(async (tx) => {
    await tx.academicPeriod.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return tx.academicPeriod.update({
      where: { id },
      data: { isActive: true },
      select: PERIOD_SELECT,
    });
  });
};

export const deleteById = async (id) => {
  try {
    return await prisma.academicPeriod.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null; 
    }
    throw error;
  }
};
