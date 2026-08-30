// src/middlewares/scope.middleware.js

import * as electionRepository from '../modules/elections/elections/election.repository.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';

/**
 * Middleware que verifica que la elección pertenezca a la misma organización del
 * usuario autenticado (Anti-IDOR).
 *
 * La tabla `elections` no almacena organization_id directamente: el tenant se
 * resuelve a través de la organización del usuario que creó la elección
 * (elections.created_by -> users.organization_id).
 *
 * Los superusuarios y los usuarios sin organización activa no se restringen
 * (el tenant no aplica a perfiles globales).
 */
export const requireElectionInScope = async (req, res, next) => {
  try {
    const electionId = req.params.id || req.query.election_id || req.query.electionId;

    if (!electionId) {
      return next(ApiError.badRequest('El ID de la elección es requerido para verificar el ámbito'));
    }

    const election = await electionRepository.findElectionById(electionId);
    if (!election) {
      return next(ApiError.notFound('Elección no encontrada'));
    }

    const isSuperAdmin =
      req.user?.role === ROLES.SUPER_ADMIN || req.user?.isSuperAdmin || req.user?.isSuperuser;

    // Sin tenant del lado del actor (perfil global) no hay ámbito que restringir.
    if (!isSuperAdmin && req.user?.organizationId) {
      const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);

      if (ownerOrgId && ownerOrgId !== req.user.organizationId) {
        return next(ApiError.forbidden('La elección no pertenece a tu organización'));
      }
    }

    req.election = election;
    next();
  } catch (err) {
    next(err);
  }
};