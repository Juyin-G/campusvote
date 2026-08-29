import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PROGRAM_SELECT = {
  id: true,
  facultyId: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
};

// Helper interno para la traducción de errores conocidos de Prisma
const handlePrismaError = (error, isDelete = false) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return null; 
    if (error.code === 'P2003') {
      throw new Error(isDelete ? 'HAS_DEPENDENCIES' : 'FOREIGN_KEY_FACULTY');
    }
    if (error.code === 'P2002') throw new Error('UNIQUE_CONSTRAINT');
  }
  throw error;
};

export const findById = (id) => 
  prisma.program.findUnique({ where: { id }, select: PROGRAM_SELECT });

export const list = ({ facultyId, skip = 0, take = 50 } = {}) => 
  prisma.program.findMany({ 
    where: facultyId ? { facultyId } : undefined, 
    select: PROGRAM_SELECT, 
    orderBy: { name: 'asc' }, 
    skip, 
    take 
  });

export const count = (facultyId = null) => 
  prisma.program.count({ where: facultyId ? { facultyId } : undefined });

export const create = async (data) => {
  try {
    return await prisma.program.create({ data, select: PROGRAM_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.program.update({ where: { id }, data, select: PROGRAM_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const deleteById = async (id) => {
  try {
    return await prisma.program.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    return handlePrismaError(error, true);
  }
};
