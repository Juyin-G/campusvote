// src/services/adminScope.service.js
// Resolución de scope administrativo multi-sede (Org → Region → Site).
//
// Reglas:
//   * ADMIN + ORG     → toda la organización
//   * ADMIN + REGION  → todas las sedes de su región
//   * ADMIN + SITE    → solo sedes listadas en user_site_assignments
//   * SUPERADMIN      → fuera del scope tenant (gestiona plataforma)
//   * otros roles     → sin scope administrativo (la organización completa
//                       les basta; el filtrado por site lo define el contexto
//                       de cada recurso, no este helper)
//
// Anti-escalada (canCreateScope):
//   * ORG     puede crear ORG / REGION / SITE dentro de su organización
//   * REGION  puede crear REGION / SITE solo dentro de su región y su organización
//   * SITE    no puede crear administradores
//   * nadie puede crear SUPERADMIN

import { prisma } from '../database/prisma.js';
import { ROLES } from '../constants/roles.js';
import { ApiError } from '../shared/errors/ApiError.js';

const SCOPE_RANK = { ORG: 3, REGION: 2, SITE: 1 };

const SCOPE_RANK_VALUE = Object.freeze({
  ORG: 3,
  REGION: 2,
  SITE: 1,
});

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;

/**
 * Devuelve el conjunto de sitios a los que el actor (ADMIN tenant) tiene
 * alcance. Si `actor.role !== 'ADMIN'` devuelve null (no aplica).
 *
 * Para SUPERADMIN devuelve null (no tiene alcance tenant; el caller debe
 * rechazar antes).
 */
export const resolveAccessibleSites = async (actor) => {
  if (!actor) return null;
  if (actor.role === ROLES.SUPERADMIN) return null;

  if (!isAdmin(actor)) {
    // STUDENT/TEACHER/JURY: la organización completa; el caller decide por
    // contexto del recurso si filtra por site.
    return null;
  }

  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  // ADMIN ORG: todas las sedes de la organización.
  if (actor.scopeLevel === 'ORG') {
    const sites = await prisma.organizationSite.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, regionId: true },
    });
    return sites.map((s) => ({ siteId: s.id, regionId: s.regionId, scope: 'ORG' }));
  }

  // ADMIN REGION: todas las sedes de la región.
  if (actor.scopeLevel === 'REGION') {
    if (!actor.regionId) {
      throw ApiError.forbidden('ADMIN REGION sin regionId');
    }
    const sites = await prisma.organizationSite.findMany({
      where: { organizationId: actor.organizationId, regionId: actor.regionId },
      select: { id: true, regionId: true },
    });
    return sites.map((s) => ({ siteId: s.id, regionId: s.regionId, scope: 'REGION' }));
  }

  // ADMIN SITE: solo las sedes asignadas vía user_site_assignments.
  if (actor.scopeLevel === 'SITE') {
    const assignments = await prisma.userSiteAssignment.findMany({
      where: { userId: actor.id },
      select: {
        siteId: true,
        expiresAt: true,
        site: { select: { organizationId: true, regionId: true } },
      },
    });
    const now = new Date();
    return assignments
      .filter((a) => !a.expiresAt || a.expiresAt > now)
      .filter((a) => a.site.organizationId === actor.organizationId)
      .map((a) => ({ siteId: a.siteId, regionId: a.site.regionId, scope: 'SITE' }));
  }

  throw ApiError.forbidden('ADMIN sin scopeLevel configurado');
};

/**
 * Devuelve los IDs de los sitios accesibles (helper conveniente para queries).
 */
export const getAccessibleSiteIds = async (actor) => {
  const sites = await resolveAccessibleSites(actor);
  if (!sites) return null; // No aplica (no es ADMIN tenant)
  return sites.map((s) => s.siteId);
};

/**
 * Determina si el actor tiene alcance sobre el sitio dado. Si actor es
 * SUPERADMIN o no es ADMIN tenant, devuelve false (excepto platform que se
 * gestiona fuera).
 */
export const actorHasSiteAccess = async (actor, siteId) => {
  if (!actor || actor.role === ROLES.SUPERADMIN) return false;
  if (!isAdmin(actor)) return false;
  const sites = await resolveAccessibleSites(actor);
  if (!sites) return false;
  return sites.some((s) => s.siteId === siteId);
};

/**
 * Determina si el actor tiene alcance sobre la región (cualquier sede de ella).
 */
export const actorHasRegionAccess = async (actor, regionId) => {
  if (!actor || actor.role === ROLES.SUPERADMIN) return false;
  if (!isAdmin(actor)) return false;
  const sites = await resolveAccessibleSites(actor);
  if (!sites) return false;
  return sites.some((s) => s.regionId === regionId);
};

/**
 * Determina si el actor tiene alcance sobre la organización completa.
 * Retorna true para ADMIN ORG; true para ADMIN REGION/SITE también (porque
 * sus sitios están restringidos a su org). Para cualquier rol no-SUPERADMIN
 * con organizationId coincidente, true.
 */
export const actorHasOrgAccess = (actor, organizationId) => {
  if (!actor) return false;
  if (actor.role === ROLES.SUPERADMIN) return false;
  return actor.organizationId === organizationId;
};

// ────────────────────────────────────────────────────────────────────────
// Anti-escalada: validar si `actor` puede crear un usuario con `targetScope`.
// ────────────────────────────────────────────────────────────────────────

/**
 * Verifica que el actor puede crear/operar sobre un target con el scope
 * indicado. Aplica la jerarquía ORG > REGION > SITE y la regla "no crear
 * SUPERADMIN".
 *
 * @param {Object} actor   Usuario autenticado (con role, organizationId, scopeLevel, regionId)
 * @param {Object} target  { role, organizationId, scopeLevel, regionId, siteIds? }
 */
export const canCreateScope = async (actor, target) => {
  if (!actor || !target) {
    throw ApiError.forbidden('Actor y target requeridos');
  }

  // 1. Nunca se puede crear SUPERADMIN desde el panel tenant.
  if (target.role === ROLES.SUPERADMIN) {
    throw ApiError.forbidden('SUPERADMIN no puede ser creado desde el panel administrativo');
  }

  // 2. Solo ADMIN puede crear otros ADMIN. El resto de roles no crean admins.
  if (target.role === ROLES.ADMIN) {
    if (!isAdmin(actor)) {
      throw ApiError.forbidden('Solo un administrador puede crear otros administradores');
    }

    // Misma organización obligatoria.
    if (actor.organizationId !== target.organizationId) {
      throw ApiError.forbidden('Solo puedes crear administradores dentro de tu organización');
    }

    const actorRank = SCOPE_RANK_VALUE[actor.scopeLevel];
    const targetRank = SCOPE_RANK_VALUE[target.scopeLevel];

    if (!actorRank || !targetRank) {
      throw ApiError.forbidden('Scope inválido');
    }

    if (actorRank < targetRank) {
      throw ApiError.forbidden(
        `Tu scope (${actor.scopeLevel}) no permite crear administradores con scope ${target.scopeLevel}`
      );
    }

    // REGION solo puede crear SITE dentro de SU región.
    if (actor.scopeLevel === 'REGION') {
      if (target.scopeLevel === 'REGION' && target.regionId !== actor.regionId) {
        throw ApiError.forbidden('Solo puedes crear ADMIN REGION dentro de tu región');
      }
      if (target.scopeLevel === 'SITE') {
        // Validar que cada siteId pertenezca a la región del actor.
        const siteIds = target.siteIds || [];
        if (siteIds.length === 0) {
          throw ApiError.badRequest('Debes indicar al menos una sede para ADMIN SITE');
        }
        const sites = await prisma.organizationSite.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, regionId: true, organizationId: true },
        });
        if (sites.length !== siteIds.length) {
          throw ApiError.badRequest('Alguna sede indicada no existe');
        }
        for (const s of sites) {
          if (s.organizationId !== actor.organizationId) {
            throw ApiError.forbidden('Una sede no pertenece a tu organización');
          }
          if (s.regionId !== actor.regionId) {
            throw ApiError.forbidden(
              'No puedes asignar sedes de otra región a un administrador'
            );
          }
        }
      }
    }

    // SITE no puede crear nada.
    if (actor.scopeLevel === 'SITE') {
      throw ApiError.forbidden('ADMIN SITE no puede crear otros administradores');
    }
  }

  return true;
};

// ────────────────────────────────────────────────────────────────────────
// Crear asignaciones de scope SITE (llamado desde users.admin.scope)
// ────────────────────────────────────────────────────────────────────────

/**
 * Reemplaza las asignaciones SITE de un ADMIN a un conjunto de sedes.
 * El caller debe haber pasado `canCreateScope` o `canAssignSites` antes.
 *
 * @param {Object} actor   Actor que asigna (debe tener alcance sobre todas las siteIds)
 * @param {string} targetUserId  Usuario al que se le asigna scope SITE
 * @param {string[]} siteIds      Lista de UUIDs de OrganizationSite
 */
export const assignSiteScopes = async ({ actor, targetUserId, siteIds }) => {
  if (!actor || actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Solo un ADMIN puede asignar sedes');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, organizationId: true, scopeLevel: true },
  });
  if (!target) throw ApiError.notFound('Usuario objetivo no encontrado');

  if (target.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('El usuario pertenece a otra organización');
  }

  if (target.scopeLevel !== 'SITE') {
    throw ApiError.badRequest('El usuario objetivo debe tener scopeLevel = SITE');
  }

  // Validar que cada siteId pertenece a la org y al alcance del actor.
  const sites = await prisma.organizationSite.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, organizationId: true, regionId: true },
  });
  if (sites.length !== siteIds.length) {
    throw ApiError.badRequest('Alguna sede indicada no existe');
  }
  for (const s of sites) {
    if (s.organizationId !== actor.organizationId) {
      throw ApiError.forbidden('Una sede no pertenece a tu organización');
    }
  }

  if (actor.scopeLevel === 'REGION') {
    for (const s of sites) {
      if (s.regionId !== actor.regionId) {
        throw ApiError.forbidden('No puedes asignar sedes fuera de tu región');
      }
    }
  }
  if (actor.scopeLevel === 'SITE') {
    const own = await prisma.userSiteAssignment.findMany({
      where: { userId: actor.id },
      select: { siteId: true },
    });
    const ownSet = new Set(own.map((a) => a.siteId));
    for (const s of sites) {
      if (!ownSet.has(s.id)) {
        throw ApiError.forbidden('No puedes asignar sedes que no te pertenecen');
      }
    }
  }

  // Reemplazar asignaciones en una transacción.
  await prisma.$transaction(async (tx) => {
    await tx.userSiteAssignment.deleteMany({ where: { userId: targetUserId } });
    if (siteIds.length > 0) {
      await tx.userSiteAssignment.createMany({
        data: siteIds.map((siteId) => ({
          userId: targetUserId,
          siteId,
          grantedBy: actor.id,
        })),
      });
    }
  });
};

export default {
  resolveAccessibleSites,
  getAccessibleSiteIds,
  actorHasSiteAccess,
  actorHasRegionAccess,
  actorHasOrgAccess,
  canCreateScope,
  assignSiteScopes,
  SCOPE_RANK,
};
