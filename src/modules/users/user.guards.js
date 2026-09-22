// src/modules/users/user.guards.js
// Guards y helpers de autorización usados por las rutas del módulo de usuarios.

import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

// Guard interno: impide que un usuario modifique su propio rol.
export const preventSelfRoleChange = (req, res, next) => {
  const actorId = req.user?.id || req.user?.userId;
  if (actorId === req.params.id) {
    return next(ApiError.badRequest('No puedes modificar tu propio rol'));
  }
  next();
};

// Guard interno: solo ADMIN ORG puede asignar rol ADMIN.
export const requireAdminScopeForAdminRole = (req, res, next) => {
  if (req.body?.role !== ROLES.ADMIN) return next();
  if (!req.user || req.user.role !== ROLES.ADMIN || req.user.scopeLevel !== 'ORG') {
    return next(
      ApiError.forbidden('Solo ADMIN ORG puede asignar/modificar el rol ADMIN dentro del tenant')
    );
  }
  next();
};

// Defensa: el sub-router ya bloqueó a SUPERADMIN, pero reforzamos aquí.
export const blockSuperAdminOnTenantRoute = (req, res, next) => {
  const actor = req.user || {};
  if (actor.role === ROLES.SUPERADMIN || actor.isSuperuser || actor.isSuperAdmin) {
    return next(
      new ApiError(
        403,
        'El administrador de plataforma no tiene acceso a esta ruta de tenant',
        null,
        'FORBIDDEN'
      )
    );
  }
  next();
};
