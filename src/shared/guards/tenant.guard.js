import { ApiError } from '../errors/ApiError.js';

/**
 * Verifica que el actor pueda operar sobre un recurso perteneciente
 * a su misma organización.
 *
 * Uso:
 *   assertTenantMatch(actor, fair, 'Feria');
 *
 * Reglas:
 *   - Debe existir un actor autenticado.
 *   - SUPERADMIN no tiene acceso operativo a recursos tenant.
 *   - El actor debe estar vinculado a una organización.
 *   - El recurso debe pertenecer a la misma organización.
 */
export const assertTenantMatch = (actor, resource, resourceName = 'recurso') => {
  if (!actor) {
    throw ApiError.unauthorized('No autenticado');
  }

  if (
    actor.role === 'SUPERADMIN' ||
    actor.isSuperuser === true ||
    actor.isSuperAdmin === true
  ) {
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso operativo a recursos de tenant'
    );
  }

  if (!actor.organizationId) {
    throw ApiError.forbidden(
      'Tu cuenta no está vinculada a ninguna organización'
    );
  }

  if (!resource?.organizationId) {
    throw ApiError.forbidden(
      `${resourceName} no tiene una organización válida`
    );
  }

  if (resource.organizationId !== actor.organizationId) {
    throw ApiError.forbidden(
      `${resourceName} no pertenece a tu organización`
    );
  }

  return true;
};

export default {
  assertTenantMatch,
};
