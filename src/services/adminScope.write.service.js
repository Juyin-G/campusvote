// src/services/adminScope.write.service.js
// Operaciones de escritura sobre scope multi-sede: canCreateScope, assignSiteScopes.

import { prisma } from '../database/prisma.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { actorHasSiteAccess, getAccessibleSiteIds } from './adminScope.read.service.js';

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;

/**
 * Política de creación de scope: ADMIN ORG crea ADMINs de cualquier nivel;
 * ADMIN REGION crea ADMINs de sede (SITE) dentro de su región; ADMIN SITE
 * no crea ADMINs. REGION/SITE pueden crear/academic delegar alcance dentro
 * de su propio scope.
 */
export const canCreateScope = async (actor, target) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo un ADMIN puede crear scopes');
  }
  if (!target?.role) {
    throw ApiError.badRequest('Debes especificar el rol del usuario objetivo');
  }

  if (target.role === ROLES.ADMIN) {
    const targetScope = target.scopeLevel || 'ORG';
    const targetRegionId = target.regionId || null;
    const targetSiteIds = target.siteIds || [];

    if (actor.scopeLevel === 'ORG') {
      return true;
    }

    if (actor.scopeLevel === 'REGION') {
      if (targetScope !== 'SITE') {
        throw ApiError.forbidden(
          'Como ADMIN de región solo puedes crear administradores de sede (SITE)'
        );
      }
      if (!actor.regionId) {
        throw ApiError.badRequest('Tu cuenta de admin de región no tiene región asignada');
      }
      if (targetRegionId && targetRegionId !== actor.regionId) {
        throw ApiError.forbidden('Solo puedes crear administradores en tu propia región');
      }
      for (const sid of targetSiteIds) {
        const site = await prisma.organizationSite.findUnique({
          where: { id: sid },
          select: { id: true, organizationId: true, regionId: true },
        });
        if (!site || site.organizationId !== actor.organizationId || site.regionId !== actor.regionId) {
          throw ApiError.forbidden(`La sede ${sid} no pertenece a tu región`);
        }
      }
      return true;
    }

    throw ApiError.forbidden('Solo ADMIN ORG o ADMIN de región puede crear usuarios con rol ADMIN');
  }

  // Usuarios académicos: SITE/REGION pueden crearlos dentro de su scope.
  const targetSiteIds = target.siteIds || [];
  if (actor.scopeLevel === 'ORG') return true;

  for (const sid of targetSiteIds) {
    const ok = await actorHasSiteAccess(actor, sid);
    if (!ok) {
      throw ApiError.forbidden(`No tienes alcance sobre la sede ${sid}`);
    }
  }
  return true;
};

/** Asigna/reemplaza las sedes (UserSiteAssignment) de un usuario objetivo. */
export const assignSiteScopes = async ({ actor, targetUserId, siteIds }) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo un ADMIN puede asignar sedes');
  }

  // El actor debe tener alcance sobre TODAS las sedes que intenta asignar.
  if (actor.scopeLevel === 'SITE') {
    for (const sid of siteIds || []) {
      const ok = await actorHasSiteAccess(actor, sid);
      if (!ok) throw ApiError.forbidden(`No tienes acceso a la sede ${sid}`);
    }
  } else if (actor.scopeLevel === 'REGION') {
    const accessible = await getAccessibleSiteIds(actor);
    for (const sid of siteIds || []) {
      if (!accessible.includes(sid)) {
        throw ApiError.forbidden(`La sede ${sid} no pertenece a tu región`);
      }
    }
  }

  await prisma.$transaction([
    prisma.userSiteAssignment.deleteMany({ where: { userId: targetUserId } }),
    prisma.userSiteAssignment.createMany({
      data: (siteIds || []).map((siteId) => ({
        userId: targetUserId,
        siteId,
        grantedBy: actor.id,
      })),
    }),
  ]);

  const refreshed = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { siteAssignments: true },
  });
  return refreshed;
};
