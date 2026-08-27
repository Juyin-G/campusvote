import { prisma } from '../../../database/prisma.js';
import { Prisma } from '@prisma/client';

const FACULTY_SELECT = {
  id: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
};

export const findById = (id) => 
  prisma.faculty.findUnique({ where: { id }, select: FACULTY_SELECT });

export const findByCode = (code) => 
  prisma.faculty.findUnique({ where: { code }, select: FACULTY_SELECT });

export const findByNameOrCode = (name, code) => {
  const OR = [];
  if (name) OR.push({ name });
  if (code) OR.push({ code });

  if (OR.length === 0) return null;

  return prisma.faculty.findFirst({
    where: { OR },
    select: FACULTY_SELECT,
  });
};

export const hasAssociatedPrograms = async (facultyId) => {
  const count = await prisma.program.count({
    where: { facultyId },
  });
  return count > 0;
};

export const list = ({ skip = 0, take = 50 } = {}) => 
  prisma.faculty.findMany({ 
    select: FACULTY_SELECT, 
    orderBy: { name: 'asc' }, 
    skip, 
    take 
  });

export const count = () => prisma.faculty.count();

export const create = (data) => 
  prisma.faculty.create({ data, select: FACULTY_SELECT });

export const update = async (id, data) => {
  try {
    return await prisma.faculty.update({ where: { id }, data, select: FACULTY_SELECT });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const deleteById = async (id) => {
  try {
    return await prisma.faculty.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null; 
    }
    throw error;
  }
};