// src/modules/juryAssignments/juryAssignment.repository.js
// Acceso a datos (Prisma) de asignaciones de jurados a ferias.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const JURY_USER_PROFILE = {
  id: true,
  firstName: true,
  lastName: true,
  institutionalId: true,
  role: true,
  status: true,
  organizationId: true,
};

const ASSIGNMENT_SELECT = {
  id: true,
  fairId: true,
  userId: true,
  assignedById: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: JURY_USER_PROFILE,
  },
};

export const findByFairUser = (fairId, userId) =>
  prisma.fairJuryAssignment.findFirst({
    where: { fairId, userId },
    select: ASSIGNMENT_SELECT,
  });

export const listByFair = (fairId) =>
  prisma.fairJuryAssignment.findMany({
    where: { fairId },
    select: ASSIGNMENT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

export const listByUser = ({ userId, skip = 0, take = 20 }) =>
  prisma.fairJuryAssignment.findMany({
    where: { userId },
    select: {
      id: true,
      fairId: true,
      userId: true,
      createdAt: true,
      fair: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          description: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });

export const countByUser = (userId) =>
  prisma.fairJuryAssignment.count({ where: { userId } });

export const create = async (data) => {
  try {
    return await prisma.fairJuryAssignment.create({
      data,
      select: ASSIGNMENT_SELECT,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('FAIR_JURY_ALREADY_ASSIGNED');
      }
      if (error.code === 'P2003') {
        throw new Error('FAIR_JURY_FOREIGN_KEY');
      }
    }
    throw error;
  }
};

export const remove = async (fairId, userId) =>
  prisma.fairJuryAssignment.deleteMany({
    where: { fairId, userId },
  });

export default {
  findByFairUser,
  listByFair,
  listByUser,
  countByUser,
  create,
  remove,
};