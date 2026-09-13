// src/modules/projects/project.repository.js
// Acceso a datos (Prisma) de proyectos y sus participantes.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PROJECT_SELECT = {
  id: true,
  organizationId: true,
  fairId: true,
  createdById: true,
  name: true,
  description: true,
  logoUrl: true,
  coverUrl: true,
  projectUrl: true,
  status: true,
  reviewedById: true,
  reviewNotes: true,
  reviewedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, firstName: true, lastName: true, institutionalId: true, role: true },
  },
  fair: {
    select: { id: true, name: true, status: true },
  },
};

const MEMBER_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  role: true,
  createdAt: true,
  user: {
    select: { id: true, firstName: true, lastName: true, institutionalId: true, role: true },
  },
};

/**
 * Traduce errores canónicos de Prisma a errores de dominio simples.
 */
const handlePrismaError = (error, { unique = 'PROJECT_UNIQUE_CONSTRAINT' } = {}) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return null;
    if (error.code === 'P2002') throw new Error(unique);
    if (error.code === 'P2003') throw new Error('PROJECT_FOREIGN_KEY');
  }
  throw error;
};

export const findById = (id) =>
  prisma.project.findUnique({
    where: { id },
    select: PROJECT_SELECT,
  });

export const findByIdWithMembers = (id) =>
  prisma.project.findUnique({
    where: { id },
    select: {
      ...PROJECT_SELECT,
      members: { select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } },
    },
  });

export const list = ({ where = {}, skip = 0, take = 20 } = {}) =>
  prisma.project.findMany({
    where,
    select: PROJECT_SELECT,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const count = (where = {}) => prisma.project.count({ where });

export const create = async (data) => {
  try {
    return await prisma.project.create({
      data,
      select: PROJECT_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.project.update({
      where: { id },
      data,
      select: PROJECT_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const findUserById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, organizationId: true, status: true, role: true },
  });

export const listMembers = (projectId) =>
  prisma.projectMember.findMany({
    where: { projectId },
    select: MEMBER_SELECT,
    orderBy: { createdAt: 'asc' },
  });

export const findMember = (projectId, userId) =>
  prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, projectId: true, userId: true, role: true },
  });

export const addMember = async (data) => {
  try {
    return await prisma.projectMember.create({
      data,
      select: MEMBER_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error, { unique: 'PROJECT_MEMBER_ALREADY_EXISTS' });
  }
};

export const removeMember = async (projectId, userId) => {
  try {
    return await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
      select: MEMBER_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export default {
  findById,
  findByIdWithMembers,
  list,
  count,
  create,
  update,
  findUserById,
  listMembers,
  findMember,
  addMember,
  removeMember,
};
