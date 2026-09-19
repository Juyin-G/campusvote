// src/modules/ratings/rating.access.js
// Helpers de acceso a elección + tenant (asume SUPERADMIN bypass).
import * as electionRepository from '../elections/elections/election.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

export const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

/**
 * Tenant: el actor pertenece a la organización de la elección.
 * SUPERADMIN bypass operativo en este módulo.
 */
export const assertTenantAccess = async ({ electionId, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
  if (ownerOrgId && ownerOrgId !== actor.organizationId) {
    throw ApiError.forbidden('La elección no pertenece a tu organización');
  }
};
