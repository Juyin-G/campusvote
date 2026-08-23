import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PERIOD_SELECT = {
  id: true,
  name: true,
  start_date: true,
  end_date: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

export const findById = (id) => 
  prisma.academic_periods.findUnique({ where: { id }, select: PERIOD_SELECT });

export const list = ({ skip = 0, take = 50 } = {}) => 
  prisma.academic_periods.findMany({ 
    select: PERIOD_SELECT, 
    orderBy: { start_date: 'desc' }, 
    skip, 
    take 
  });

export const count = () => prisma.academic_periods.count();

export const checkOverlap = async (startDate, endDate, excludeId = null) => {
  const where = {
    is_active: true,
    AND: [
      { start_date: { lte: endDate } },
      { end_date: { gte: startDate } },
    ],
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.academic_periods.findFirst({
    where,
    select: { id: true, name: true, start_date: true, end_date: true },
  });
};

export const create = (data) => 
  prisma.academic_periods.create({ data, select: PERIOD_SELECT });

export const update = async (id, data) => {
  try {
    return await prisma.academic_periods.update({ where: { id }, data, select: PERIOD_SELECT });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const setActive = async (id) => {
  return prisma.$transaction(async (tx) => {
    await tx.academic_periods.updateMany({
      where: { is_active: true },
      data: { is_active: false },
    });

    return tx.academic_periods.update({
      where: { id },
      data: { is_active: true },
      select: PERIOD_SELECT,
    });
  });
};

export const deleteById = async (id) => {
  try {
    return await prisma.academic_periods.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null; 
    }
    throw error;
  }
};