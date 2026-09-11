import { prisma } from '../../../database/prisma.js';

export const list = async ({ organizationId, careerId, isActive, skip = 0, take = 50 } = {}) => {
  if (!organizationId) {
    throw new Error('organizationId requerido para listar cursos');
  }
  return prisma.course.findMany({
    where: {
      organizationId,
      ...(isActive === undefined ? {} : { isActive }),
      ...(careerId ? { careerId } : {}),
    },
    orderBy: [{ isActive: 'desc' }, { cycle: 'asc' }, { code: 'asc' }],
    skip,
    take,
    include: { career: { select: { code: true, name: true, cycle: true } } },
  });
};

export const count = async ({ organizationId, careerId, isActive } = {}) => {
  if (!organizationId) return 0;
  return prisma.course.count({
    where: {
      organizationId,
      ...(isActive === undefined ? {} : { isActive }),
      ...(careerId ? { careerId } : {}),
    },
  });
};

export const findById = async (id, organizationId) =>
  prisma.course.findFirst({
    where: { id, organizationId },
    include: { career: { select: { code: true, name: true, cycle: true } } },
  });

export const findByCode = async (code, organizationId, careerId) =>
  prisma.course.findFirst({
    where: { code, organizationId, ...(careerId ? { careerId } : {}) },
  });

export const create = async ({ organizationId, code, name, cycle, careerId }) =>
  prisma.course.create({
    data: {
      organizationId,
      careerId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      cycle,
      isActive: true,
    },
  });

export const update = async (id, organizationId, data) => {
  const updateData = {};
  if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.cycle !== undefined) updateData.cycle = data.cycle;
  if (data.careerId !== undefined) updateData.careerId = data.careerId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  return prisma.course.update({
    where: { id },
    data: updateData,
  });
};

export const deleteById = async (id) =>
  prisma.course.delete({ where: { id } });

export const hasAssociatedAssignments = async (courseId) => {
  const count = await prisma.teachingAssignment.count({
    where: { courseId, isActive: true },
  });
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
  hasAssociatedAssignments,
};
