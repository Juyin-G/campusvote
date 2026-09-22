// src/services/adminScope.read.service.js
// Lectura de scope administrativo multi-sede: resolveAccessibleSites,
// getAccessibleSiteIds, hasXAccess.

import { prisma } from '../database/prisma.js';

/** Resuelve las sedes accesibles para un actor ADMIN según su scope. */
export const resolveAccessibleSites = async (actor) => {
  if (!actor?.organizationId) return [];
  const where = { organizationId: actor.organizationId };

  if (actor.scopeLevel === 'ORG') {
    return prisma.organizationSite.findMany({ where, orderBy: { name: 'asc' } });
  }
  if (actor.scopeLevel === 'REGION' && actor.regionId) {
    return prisma.organizationSite.findMany({
      where: { ...where, regionId: actor.regionId },
      orderBy: { name: 'asc' },
    });
  }
  if (actor.scopeLevel === 'SITE') {
    const assignments = await prisma.userSiteAssignment.findMany({
      where: { userId: actor.id },
      select: { siteId: true },
    });
    const siteIds = assignments.map((a) => a.siteId);
    if (siteIds.length === 0) return [];
    return prisma.organizationSite.findMany({
      where: { ...where, id: { in: siteIds } },
      orderBy: { name: 'asc' },
    });
  }
  return [];
};

/** Devuelve solo los IDs de sedes accesibles. */
export const getAccessibleSiteIds = async (actor) => {
  const sites = await resolveAccessibleSites(actor);
  return sites.map((s) => s.id);
};

/** ¿El actor tiene acceso a una sede concreta? */
export const actorHasSiteAccess = async (actor, siteId) => {
  if (!actor?.organizationId || !siteId) return false;
  if (actor.scopeLevel === 'ORG') {
    const site = await prisma.organizationSite.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });
    return site?.organizationId === actor.organizationId;
  }
  if (actor.scopeLevel === 'REGION' && actor.regionId) {
    const site = await prisma.organizationSite.findUnique({
      where: { id: siteId },
      select: { organizationId: true, regionId: true },
    });
    return site?.organizationId === actor.organizationId && site?.regionId === actor.regionId;
  }
  if (actor.scopeLevel === 'SITE') {
    const a = await prisma.userSiteAssignment.findFirst({
      where: { userId: actor.id, siteId },
      select: { id: true },
    });
    return Boolean(a);
  }
  return false;
};

export const actorHasRegionAccess = async (actor, regionId) => {
  if (!actor?.organizationId || !regionId) return false;
  if (actor.scopeLevel === 'ORG') return true;
  if (actor.scopeLevel === 'REGION') return actor.regionId === regionId;
  return false;
};

export const actorHasOrgAccess = (actor, organizationId) =>
  Boolean(actor?.organizationId) && actor.organizationId === organizationId;
