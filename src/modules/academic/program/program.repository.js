import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PROGRAM_SELECT = {
  id: true,
  faculty_id: true,
  name: true,
  code: true,
  created_at: true,
  updated_at: true,
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
  prisma.programs.findUnique({ where: { id }, select: PROGRAM_SELECT });

export const list = ({ faculty_id, skip = 0, take = 50 } = {}) => 
  prisma.programs.findMany({ 
    where: faculty_id ? { faculty_id } : undefined, 
    select: PROGRAM_SELECT, 
    orderBy: { name: 'asc' }, 
    skip, 
    take 
  });

export const count = (faculty_id = null) => 
  prisma.programs.count({ where: faculty_id ? { faculty_id } : undefined });

export const create = async (data) => {
  try {
    return await prisma.programs.create({ data, select: PROGRAM_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const update = async (id, data) => {
  try {
    return await prisma.programs.update({ where: { id }, data, select: PROGRAM_SELECT });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export const deleteById = async (id) => {
  try {
    return await prisma.programs.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    return handlePrismaError(error, true);
  }
};