import prisma from '../../config/prisma.js';

export const USER_PUBLIC_SELECT = {
  id: true,
  username: true,
  email: true,
  first_name: true,
  last_name: true,
  institutional_id: true,
  role: true,
  is_active: true,
  is_verified: true,
  is_staff: true,
  is_superuser: true,
  organization_id: true,
  two_factor_enabled: true,
  must_change_password: true,
  last_login: true,
  date_joined: true,
};

const buildWhere = ({ organization_id, role, search } = {}) => {
  const where = {};
  if (organization_id) where.organization_id = organization_id;
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { first_name: { contains: search, mode: 'insensitive' } },
      { last_name: { contains: search, mode: 'insensitive' } },
      { institutional_id: { contains: search, mode: 'insensitive' } },
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

export const findByInstitutionalId = (institutional_id) =>
  prisma.user.findUnique({
    where: { institutional_id },
    select: USER_PUBLIC_SELECT,
  });

export const list = ({ organization_id, role, search, skip = 0, take = 10 } = {}) =>
  prisma.user.findMany({
    where: buildWhere({ organization_id, role, search }),
    select: USER_PUBLIC_SELECT,
    skip,
    take,
  });

export const count = ({ organization_id, role, search } = {}) =>
  prisma.user.count({
    where: buildWhere({ organization_id, role, search }),
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

export const updateRole = (id, role) =>
  prisma.user.update({
    where: { id },
    data: { role },
    select: USER_PUBLIC_SELECT,
  });

export const setActive = (id, is_active) =>
  prisma.user.update({
    where: { id },
    data: { is_active },
    select: USER_PUBLIC_SELECT,
  });

export const resetSecurityFlags = (id) =>
  prisma.user.update({
    where: { id },
    data: {
      failed_login_attempts: 0,
      must_change_password: false,
      two_factor_enabled: false,
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

export const updateTwoFactorEnabled = (id, two_factor_enabled) =>
  prisma.user.update({
    where: { id },
    data: { two_factor_enabled },
    select: USER_PUBLIC_SELECT,
  });