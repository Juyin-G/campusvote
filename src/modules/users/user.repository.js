import { prisma } from '../../database/prisma.js';

export const USER_PUBLIC_SELECT = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  institutionalId: true,
  role: true,
  status: true,
  isVerified: true,
  isStaff: true,
  isSuperuser: true,
  organizationId: true,
  twoFactorEnabled: true,
  mustChangePassword: true,
  lastLogin: true,
  dateJoined: true,
};

const buildWhere = ({ organizationId, role, search, isActive } = {}) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (role) where.role = role;
  if (isActive !== undefined) {
    const active = isActive === 'true' || isActive === true;
    where.status = active ? 'ACTIVE' : { not: 'ACTIVE' };
  }
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { institutionalId: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
};

export const findById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: USER_PUBLIC_SELECT,
  });

export const findByEmail = (email) =>
  prisma.user.findUnique({
    where: { email },
    select: USER_PUBLIC_SELECT,
  });

export const findByUsername = (username) =>
  prisma.user.findUnique({
    where: { username },
    select: USER_PUBLIC_SELECT,
  });

export const findByInstitutionalId = (institutionalId) =>
  prisma.user.findUnique({
    where: { institutionalId },
    select: USER_PUBLIC_SELECT,
  });

export const list = ({ organizationId, role, search, isActive, skip = 0, take = 10 } = {}) =>
  prisma.user.findMany({
    where: buildWhere({ organizationId, role, search, isActive }),
    select: USER_PUBLIC_SELECT,
    orderBy: { dateJoined: 'desc' },
    skip,
    take,
  });

export const count = ({ organizationId, role, search, isActive } = {}) =>
  prisma.user.count({
    where: buildWhere({ organizationId, role, search, isActive }),
  });

export const create = (data) =>
  prisma.user.create({
    data,
    select: USER_PUBLIC_SELECT,
  });

export const update = (id, data) =>
  prisma.user.update({
    where: { id },
    data,
    select: USER_PUBLIC_SELECT,
  });

/**
 * Cambia el rol y limpia los datos que dejan de aplicar.
 * La BD lo exige: chk_users_student_data obliga a que current_cycle y
 * admission_period_id sean NULL en quien no es estudiante, y
 * chk_users_teacher_data hace lo mismo con specialty y department.
 */
export const updateRole = (id, role) =>
  prisma.user.update({
    where: { id },
    data: {
      role,
      ...(role === 'STUDENT'
        ? {}
        : { currentCycle: null, admissionPeriodId: null }),
      ...(role === 'TEACHER' ? {} : { specialty: null, department: null }),
    },
    select: USER_PUBLIC_SELECT,
  });

export const setActive = (id, isActive) =>
  prisma.user.update({
    where: { id },
    data: { status: isActive ? 'ACTIVE' : 'SUSPENDED' },
    select: USER_PUBLIC_SELECT,
  });

export const resetSecurityFlags = (id) =>
  prisma.user.update({
    where: { id },
    data: {
      failedLoginAttempts: 0,
      mustChangePassword: false,
      twoFactorEnabled: false,
    },
    select: USER_PUBLIC_SELECT,
  });

export const deleteById = (id) =>
  prisma.user.delete({
    where: { id },
    select: USER_PUBLIC_SELECT,
  });

export const updatePassword = (id, password) =>
  prisma.user.update({
    where: { id },
    data: { password },
    select: USER_PUBLIC_SELECT,
  });

export const updateTwoFactorEnabled = (id, twoFactorEnabled) =>
  prisma.user.update({
    where: { id },
    data: { twoFactorEnabled },
    select: USER_PUBLIC_SELECT,
  });