import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PERIOD_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const findById = (id) => 
  prisma.academicPeriod.findUnique({ where: { id }, select: PERIOD_SELECT });

// Un ADMIN ve los períodos de SU institución y los heredados (sin
// organización), que existían antes de que los períodos fueran por institución.
export const buildScopeWhere = (organizationId) =>
  organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : { organizationId: null };

export const list = ({ skip = 0, take = 50, organizationId = null } = {}) =>
  prisma.academicPeriod.findMany({
    where: buildScopeWhere(organizationId),
    select: PERIOD_SELECT,
    orderBy: { startDate: 'desc' },
    skip,
    take
  });

export const count = (organizationId = null) =>
  prisma.academicPeriod.count({ where: buildScopeWhere(organizationId) });

// El solape se evalúa DENTRO de la misma institución: dos universidades
// pueden tener su 2026-II activo al mismo tiempo (ex_academic_periods_no_overlap_per_org).
export const checkOverlap = async (startDate, endDate, excludeId = null, organizationId = null) => {
  const from = startDate instanceof Date ? startDate : new Date(startDate);
  const to = endDate instanceof Date ? endDate : new Date(endDate);

  const where = {
    isActive: true,
    organizationId,
    AND: [
      { startDate: { lte: to } },
      { endDate: { gte: from } },
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

/** Ferias que ya usan el período (bloquean su eliminación). */
export const hasAssociatedFairs = async (periodId) => {
  const count = await prisma.fair.count({ where: { academicPeriodId: periodId } });
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

export const setActive = async (id, organizationId = null) => {
  return prisma.$transaction(async (tx) => {
    // Activar un período apaga solo los de la MISMA institución.
    await tx.academicPeriod.updateMany({
      where: { isActive: true, organizationId },
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
