// src/modules/organizations/organizationSite/organizationSite.repository.js
// Acceso a datos (Prisma) de sedes de organizaciones.

import { prisma } from '../../../database/prisma.js';

const SITE_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  address: true,
  city: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
};

export const findById = (id) =>
  prisma.organizationSite.findUnique({ where: { id }, select: SITE_SELECT });

export const listByOrganization = (organizationId) =>
  prisma.organizationSite.findMany({
    where: { organizationId },
    select: SITE_SELECT,
    orderBy: { createdAt: 'desc' },
  });

export const listAll = () =>
  prisma.organizationSite.findMany({
    select: SITE_SELECT,
    orderBy: { createdAt: 'desc' },
  });

export const create = (data) =>
  prisma.organizationSite.create({ data, select: SITE_SELECT });

export const update = (id, data) =>
  prisma.organizationSite.update({ where: { id }, data, select: SITE_SELECT });

export const remove = (id) =>
  prisma.organizationSite.delete({ where: { id }, select: SITE_SELECT });

export default {
  findById,
  listByOrganization,
  listAll,
  create,
  update,
  remove,
};