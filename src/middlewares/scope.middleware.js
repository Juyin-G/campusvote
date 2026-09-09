// src/middlewares/scope.middleware.js

import * as electionRepository from '../modules/elections/elections/election.repository.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import auditService from '../modules/audit/audit.service.js';
import logger from '../config/logger.js';
import { prisma } from '../database/prisma.js';

/**
 * Registra en auditoría los intentos de acceso fuera del ámbito (anti-IDOR)
 * para poder contabilizar y bloquear comportamientos sospechosos.
 */
const logAccessDenied = async ({ req, electionId, reason }) => {
  try {
    await auditService.logAction({
      actorId: req.user?.id ?? req.user?.userId ?? null,
      electionId: electionId || null,
      action: 'ACCESS_DENIED',
      ipAddress: req.ip ?? null,
      metadata: { reason, path: req.originalUrl },
    });
  } catch (err) {
    logger.warn('No se pudo registrar ACCESO_DENIED en auditoría', { error: err.message });
  }
};

/**
 * Middleware que verifica que la elección pertenezca a la misma organización del
 * usuario autenticado (Anti-IDOR).
 *
 * La elección guarda organization_id y se usa el creador como compatibilidad
 * para datos antiguos que todavía no tengan ese valor.
 *
 * Los superusuarios y los usuarios sin organización activa no se restringen
 * (el tenant no aplica a perfiles globales).
 */
export const requireElectionInScope = async (req, res, next) => {
  try {
    const electionId =
      req.params.id ||
      req.params.electionId ||
      req.params.election_id ||
      req.query.election_id ||
      req.query.electionId ||
      req.body?.election_id ||
      req.body?.electionId;

    if (!electionId) {
      return next(ApiError.badRequest('El ID de la elección es requerido para verificar el ámbito'));
    }

    const election = await electionRepository.findElectionById(electionId);
    if (!election) {
      return next(ApiError.notFound('Elección no encontrada'));
    }

    const isSuperAdmin =
      req.user?.role === ROLES.SUPERADMIN || req.user?.isSuperAdmin || req.user?.isSuperuser;

    if (!isSuperAdmin) {
      if (!req.user?.organizationId) {
        await logAccessDenied({ req, electionId, reason: 'no_organization' });
        return next(ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización'));
      }
      
      const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);

      if (ownerOrgId && ownerOrgId !== req.user.organizationId) {
        await logAccessDenied({ req, electionId, reason: 'election_scope_mismatch' });
        return next(ApiError.forbidden('La elección no pertenece a tu organización'));
      }
    }

    req.election = election;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireBallotInScope = async (req, res, next) => {
  try {
    const ballot = await prisma.ballot.findUnique({
      where: { id: req.params.ballotId },
      select: { electionId: true },
    });
    if (!ballot) {
      return next(ApiError.notFound('Boleta no encontrada'));
    }
    req.params.electionId = ballot.electionId;
    return requireElectionInScope(req, res, next);
  } catch (err) {
    return next(err);
  }
};