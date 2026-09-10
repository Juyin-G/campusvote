import { prisma } from '../../../database/prisma.js';

export const list = async ({ organizationId, skip = 0, take = 50 } = {}) => {
  if (!organizationId) {
    throw new Error('organizationId requerido para listar carreras');
  }
  return prisma.career.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ code: 'asc' }],
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

export const count = async ({ organizationId } = {}) => {
  if (!organizationId) return 0;
  return prisma.career.count({ where: { organizationId, isActive: true } });
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
  const cycleValue = total_cycles ?? 6
  return prisma.career.create({
    data: {
      organizationId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      cycle: cycleValue,
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

export default {
  list,
  count,
  findById,
  findByCode,
  create,
  update,
  deleteById,
  hasAssociatedCourses,
};
