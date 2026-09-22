// src/middlewares/tenantScope.middleware.js
// Guards de scope para rutas de gestión de USUARIOS DE TENANT.
//
// El requerimiento del issue es claro:
//   "SUPERADMIN NO debe usar el CRUD de usuarios académicos de una
//    organización. La gestión de STUDENT/TEACHER/JURY es exclusiva
//    del ADMIN tenant según su scope."
//
// Estos middlewares se montan DESPUÉS de blockSuperAdminFromTenantRoutes,
// por lo que el actor ya viene validado como ADMIN tenant (no SUPERADMIN).
//
// Reglas:
//   * ADMIN ORG     → opera sobre toda su organización.
//   * ADMIN REGION  → opera sobre usuarios cuyas sedes están en su región.
//   * ADMIN SITE    → opera sobre usuarios asignados a sus sedes.
//
// La regla se aplica a TODO endpoint del CRUD de usuarios:
// creación individual, bulk, edición, eliminación, bloqueo/desbloqueo,
// asignación de sede, asignación académica, generación de PDF.

import { prisma } from '../database/prisma.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import {
  resolveAccessibleSites,
  actorHasSiteAccess,
  actorHasRegionAccess,
} from '../services/adminScope.service.js';

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;
const isSuperUser = (actor) =>
  actor?.role === ROLES.SUPERADMIN ||
  actor?.isSuperuser ||
  actor?.isSuperAdmin;

/**
 * Resuelve la lista de IDs de sitios accesibles para un ADMIN tenant.
 * Para ADMIN ORG devuelve null (sin filtro por site).
 * Para ADMIN REGION/SITE devuelve la lista de siteIds.
 */
const getAccessibleSiteIdsForActor = async (actor) => {
  if (!isAdmin(actor)) return null;
  const sites = await resolveAccessibleSites(actor);
  if (!sites) return null;
  return sites.map((s) => s.siteId);
};

/**
 * Comprueba si el actor puede tocar al usuario target según su scope.
 * Las tres reglas:
 *   1. Mismo organizationId (frontera tenant).
 *   2. Si el actor tiene un scope SITE, el target solo puede tener
 *      siteAssignments dentro de sus sitios.
 *   3. Si el actor tiene scope REGION, el target solo puede tener
 *      siteAssignments dentro de su región.
 *
 * `targetSiteIds` debe ser un array de siteIds del usuario target
 * (vacío si no tiene asignaciones SITE en este momento).
 */
export const canActorActOnUser = async (actor, targetOrganizationId, targetSiteIds = []) => {
  if (!actor) throw ApiError.unauthorized('No autenticado');

  if (isSuperUser(actor)) {
    // SUPERADMIN nunca llega aquí (blockSuperAdminFromTenantRoutes).
    // Por defensa adicional, devolvemos forbidden.
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso al CRUD de usuarios de tenant'
    );
  }

  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo un administrador puede realizar esta acción');
  }

  if (actor.organizationId !== targetOrganizationId) {
    throw ApiError.forbidden('El usuario pertenece a otra organización');
  }

  if (!actor.scopeLevel) {
    throw ApiError.forbidden('Tu cuenta administrativa no tiene scope configurado');
  }

  // ADMIN ORG: no aplica filtro por site.
  if (actor.scopeLevel === 'ORG') return true;

  // ADMIN REGION: target debe tener al menos una sede dentro de la región.
  if (actor.scopeLevel === 'REGION') {
    if (!actor.regionId) {
      throw ApiError.forbidden('ADMIN REGION sin región asignada');
    }
    if (targetSiteIds.length === 0) {
      // Usuario académico no asignado a ninguna sede. Para REGION esto
      // significa que el administrador no puede decidir sobre él porque
      // no sabe a qué región pertenece. Se rechaza salvo que el target
      // no sea un usuario académico.
      return false;
    }
    // Verificar que al menos una de sus sedes esté en la región del actor.
    const sites = await prisma.organizationSite.findMany({
      where: { id: { in: targetSiteIds } },
      select: { regionId: true },
    });
    return sites.some((s) => s.regionId === actor.regionId);
  }

  // ADMIN SITE: cada sede del target debe estar entre sus sedes asignadas.
  if (actor.scopeLevel === 'SITE') {
    if (targetSiteIds.length === 0) return false;
    const accessible = await resolveAccessibleSites(actor);
    const allowedSet = new Set((accessible || []).map((s) => s.siteId));
    return targetSiteIds.every((s) => allowedSet.has(s));
  }

  return false;
};

/**
 * Middleware factory: garantiza que el actor puede modificar/eliminar
 * al usuario con id `req.params.id`.
 *
 * Carga el target, sus siteAssignments, y evalúa canActorActOnUser.
 * Si falla, responde 403.
 */
export const requireActorCanActOnUser = (paramName = 'id') =>
  async (req, res, next) => {
    try {
      const targetId = req.params[paramName];
      if (!targetId) {
        return next(ApiError.badRequest(`Falta el parámetro ${paramName}`));
      }

      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          organizationId: true,
          siteAssignments: { select: { siteId: true } },
        },
      });
      if (!target) {
        return next(ApiError.notFound('Usuario no encontrado'));
      }

      const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
      const allowed = await canActorActOnUser(
        req.user,
        target.organizationId,
        siteIds
      );
      if (!allowed) {
        return next(
          ApiError.forbidden(
            'No tienes autorización sobre este usuario (scope insuficiente)'
          )
        );
      }

      // Cacheamos para los siguientes middlewares/controladores.
      req.targetUser = target;
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Aplica un filtro de scope a una query de Prisma sobre User.
 * Devuelve el objeto `where` adicional para que `where = { AND: [base, scope] }`.
 *
 * Para ORG: no añade nada (toda la org).
 * Para REGION: siteAssignments.some(site.regionId == actor.regionId).
 * Para SITE: siteAssignments.some(siteId in actor.accessibles).
 */
export const buildScopeUserWhere = async (actor) => {
  if (isSuperUser(actor)) {
    // Defensa: SUPERADMIN no debería llegar al CRUD tenant.
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso al CRUD de usuarios de tenant'
    );
  }
  if (!actor || actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Solo un administrador puede realizar esta acción');
  }

  const where = {
    organizationId: actor.organizationId,
    role: { not: ROLES.SUPERADMIN },
  };

  if (actor.scopeLevel === 'REGION') {
    if (!actor.regionId) {
      throw ApiError.forbidden('ADMIN REGION sin región asignada');
    }
    where.siteAssignments = {
      some: { site: { regionId: actor.regionId } },
    };
  } else if (actor.scopeLevel === 'SITE') {
    const siteIds = await getAccessibleSiteIdsForActor(actor);
    if (!siteIds || siteIds.length === 0) {
      // Sin sedes asignadas: no ve a nadie.
      where.id = '__no_match_actor_no_sites__';
    } else {
      where.siteAssignments = { some: { siteId: { in: siteIds } } };
    }
  }

  return where;
};

/**
 * Middleware que aplica el scope a req. Lo deja disponible en
 * `req.scope.userWhere` para los service calls.
 */
export const attachScopeUserFilter = async (req, res, next) => {
  try {
    const userWhere = await buildScopeUserWhere(req.user);
    req.scope = req.scope || {};
    req.scope.userWhere = userWhere;
    next();
  } catch (err) {
    next(err);
  }
};

export default {
  canActorActOnUser,
  requireActorCanActOnUser,
  buildScopeUserWhere,
  attachScopeUserFilter,
  getAccessibleSiteIdsForActor,
  actorHasSiteAccess,
  actorHasRegionAccess,
};
