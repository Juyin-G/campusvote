// src/middlewares/scope.middleware.js
// CAMBIO: el SUPERADMIN ya no recibe bypass global. Se elimina el atajo
// "if (isSuperAdmin) return next()". Toda ruta de tenant debe rechazar al
// SUPERADMIN con 403 explícito. Se agrega requireFairInScope y
// requireProjectInScope con la misma política.

import * as electionRepository from '../modules/elections/elections/election.repository.js';
import * as fairRepository from '../modules/fairs/fair.repository.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import auditService from '../modules/audit/audit.service.js';
import logger from '../config/logger.js';
import { prisma } from '../database/prisma.js';

// CAMBIO: helper único de rechazo. Centraliza el mensaje literal que verán
// los auditores y los logs cuando un SUPERADMIN intente acceder a tenant.
const rejectSuperAdminAccess = async ({ req, resourceId, reason, resourceType }) => {
  try {
    await auditService.logAction({
      actorId: req.user?.id ?? req.user?.userId ?? null,
      electionId: resourceType === 'election' ? resourceId : null,
      action: 'ACCESS_DENIED',
      ipAddress: req.ip ?? null,
      metadata: {
        reason,
        resourceType,
        actorRole: req.user?.role,
        path: req.originalUrl,
      },
    });
  } catch (err) {
    logger.warn('No se pudo registrar ACCESO_DENIED en auditoría', { error: err.message });
  }
  throw ApiError.forbidden('El administrador de plataforma no tiene acceso a recursos de tenant');
};

// CAMBIO: helper compartido. Todo actor (ADMIN, JURY, COMISIÓN, STUDENT,
// TEACHER) DEBE tener organizationId. SUPERADMIN tiene organizationId=null
// por bootstrap; este helper es la primera línea de defensa antes de
// comparar con el tenant del recurso.
const assertActorHasOrganization = (actor) => {
  if (!actor?.organizationId) {
    throw ApiError.forbidden('El administrador de plataforma no tiene acceso a recursos de tenant');
  }
};

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
 * Verifica que la elección pertenezca a la misma organización del usuario
 * autenticado (Anti-IDOR).
 *
 * REGLA DE ORO: el SUPERADMIN NO recibe bypass. Aun cuando el JWT traiga
 * isSuperuser=true, se evalúa la organización del actor. Si el SUPERADMIN
 * llegó hasta aquí, debe ser bloqueado.
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

    // CAMBIO: cualquier actor sin organizationId (incluido SUPERADMIN) cae
    // aquí. La excepción previa para SUPERADMIN fue ELIMINADA.
    assertActorHasOrganization(req.user);

    const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
    if (ownerOrgId && ownerOrgId !== req.user.organizationId) {
      await logAccessDenied({ req, electionId, reason: 'election_scope_mismatch' });
      return next(ApiError.forbidden('La elección no pertenece a tu organización'));
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

// CAMBIO: NUEVO middleware. Misma política que requireElectionInScope pero
// para ferias. Antes el service validaba tenant; ahora lo bloqueamos aquí
// para tener un solo punto de control de acceso cross-tenant.
export const requireFairInScope = async (req, res, next) => {
  try {
    const fairId = req.params.id || req.params.fairId;

    if (!fairId) {
      return next(ApiError.badRequest('El ID de la feria es requerido para verificar el ámbito'));
    }

    const fair = await fairRepository.findById(fairId);
    if (!fair) {
      return next(ApiError.notFound('Feria no encontrada'));
    }

    // CAMBIO: sin bypass. SUPERADMIN sin organizationId → 403 inmediato.
    if (!req.user?.organizationId) {
      await rejectSuperAdminAccess({
        req,
        resourceId: fairId,
        reason: 'no_organization',
        resourceType: 'fair',
      });
    }

    if (fair.organizationId !== req.user.organizationId) {
      await logAccessDenied({ req, electionId: null, reason: 'fair_scope_mismatch' });
      return next(ApiError.forbidden('La feria no pertenece a tu organización'));
    }

    req.fair = fair;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireProjectInScope = async (req, res, next) => {
  try {
    const projectId = req.params.id || req.params.projectId;

    if (!projectId) {
      return next(ApiError.badRequest('El ID del proyecto es requerido para verificar el ámbito'));
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true, fairId: true },
    });
    if (!project) {
      return next(ApiError.notFound('Proyecto no encontrado'));
    }

    if (!req.user?.organizationId) {
      await rejectSuperAdminAccess({
        req,
        resourceId: projectId,
        reason: 'no_organization',
        resourceType: 'project',
      });
    }

    if (project.organizationId !== req.user.organizationId) {
      await logAccessDenied({ req, electionId: null, reason: 'project_scope_mismatch' });
      return next(ApiError.forbidden('El proyecto no pertenece a tu organización'));
    }

    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};
