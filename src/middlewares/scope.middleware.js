// src/middlewares/scope.middleware.js
// CAMBIO: el SUPERADMIN ya no recibe bypass global. Se elimina el atajo
// "if (isSuperAdmin) return next()". Toda ruta de tenant debe rechazar al
// SUPERADMIN con 403 explícito. Se agrega requireFairInScope y
// requireProjectInScope con la misma política.

import * as fairRepository from '../modules/fairs/fair.repository.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import auditService from '../modules/audit/audit.service.js';
import logger from '../config/logger.js';
import { prisma } from '../database/prisma.js';

// CAMBIO: helper único de rechazo. Centraliza el mensaje literal que verán
// los auditores y los logs cuando un SUPERADMIN intente acceder a tenant.
const rejectSuperAdminAccess = async ({ req, reason, resourceType }) => {
  try {
    await auditService.logAction({
      actorId: req.user?.id ?? req.user?.userId ?? null,
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

const logAccessDenied = async ({ req, reason }) => {
  try {
    await auditService.logAction({
      actorId: req.user?.id ?? req.user?.userId ?? null,
      action: 'ACCESS_DENIED',
      ipAddress: req.ip ?? null,
      metadata: { reason, path: req.originalUrl },
    });
  } catch (err) {
    logger.warn('No se pudo registrar ACCESO_DENIED en auditoría', { error: err.message });
  }
};

// CAMBIO: NUEVO middleware. Misma política de tenant que el resto del
// middleware de scope pero
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
        reason: 'no_organization',
        resourceType: 'fair',
      });
    }

    if (fair.organizationId !== req.user.organizationId) {
      await logAccessDenied({ req, reason: 'fair_scope_mismatch' });
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
        reason: 'no_organization',
        resourceType: 'project',
      });
    }

    if (project.organizationId !== req.user.organizationId) {
      await logAccessDenied({ req, reason: 'project_scope_mismatch' });
      return next(ApiError.forbidden('El proyecto no pertenece a tu organización'));
    }

    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};
