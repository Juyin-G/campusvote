import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const FACULTY_SELECT = {
  id: true,
  name: true,
  code: true,
  created_at: true,
  updated_at: true,
};

export const findById = (id) => 
  prisma.faculties.findUnique({ where: { id }, select: FACULTY_SELECT });

export const findByCode = (code) => 
  prisma.faculties.findUnique({ where: { code }, select: FACULTY_SELECT });

export const list = ({ skip = 0, take = 50 } = {}) => 
  prisma.faculties.findMany({ 
    select: FACULTY_SELECT, 
    orderBy: { name: 'asc' }, 
    skip, 
    take 
  });

export const count = () => prisma.faculties.count();

export const create = (data) => 
  prisma.faculties.create({ data, select: FACULTY_SELECT });

export const update = async (id, data) => {
  try {
    return await prisma.faculties.update({ where: { id }, data, select: FACULTY_SELECT });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const deleteById = async (id) => {
  try {
    return await prisma.faculties.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null; 
    }
    throw error;
  }
};