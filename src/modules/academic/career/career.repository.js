import { prisma } from '../../../database/prisma.js';

export const list = async ({ organizationId, isActive, skip = 0, take = 50 } = {}) => {
  if (!organizationId) {
    throw new Error('organizationId requerido para listar carreras');
  }
  return prisma.career.findMany({
    where: {
      organizationId,
      ...(isActive === undefined ? {} : { isActive }),
    },
    orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    skip,
    take,
    select: {
      id: true,
      code: true,
      name: true,
      cycle: true,
      isActive: true,
    },
  });
};

export const count = async ({ organizationId, isActive } = {}) => {
  if (!organizationId) return 0;
  return prisma.career.count({
    where: {
      organizationId,
      ...(isActive === undefined ? {} : { isActive }),
    },
  });
};

export const findById = async (id, organizationId) =>
  prisma.career.findFirst({
    where: { id, organizationId },
    select: { id: true, code: true, name: true, cycle: true, isActive: true },
  });

export const findByCode = async (code, organizationId) =>
  prisma.career.findFirst({
    where: { code, organizationId },
    select: { id: true, code: true, name: true, cycle: true, isActive: true },
  });

export const create = async ({ organizationId, code, name, total_cycles }) => {
  return prisma.career.create({
    data: {
      organizationId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      cycle: total_cycles,
      isActive: true,
    },
    select: { id: true, code: true, name: true, cycle: true, isActive: true },
  });
};

export const update = async (id, organizationId, data) => {
  const updateData = {};
  if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.total_cycles !== undefined) updateData.cycle = data.total_cycles;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  return prisma.career.update({
    where: { id },
    data: updateData,
    select: { id: true, code: true, name: true, cycle: true, isActive: true },
  });
};

export const deleteById = async (id) =>
  prisma.career.delete({ where: { id } });

export const hasAssociatedCourses = async (careerId) => {
  const count = await prisma.course.count({ where: { careerId, isActive: true } });
  return count > 0;
};

export const maxCourseCycle = async (careerId) => {
  const result = await prisma.course.aggregate({
    where: { careerId },
    _max: { cycle: true },
  });
  return result._max?.cycle ?? 0;
};

export default {
  list,
  count,
  findById,
  findByCode,
  create,
  update,
  deleteById,
  hasAssociatedCourses,
  maxCourseCycle,
};
