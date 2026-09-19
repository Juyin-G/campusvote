// src/modules/projects/project.lifecycle.service.js
// Operaciones de ciclo de vida del proyecto: list/get/create/update/submit/review.

import * as projectRepository from './project.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import {
  FAIR_REGISTRATION_STATUSES,
  REVIEWER_ROLES,
  isOrgAdmin,
  loadProject,
  mapProject,
  assertTenantMatch,
  assertOwner,
  assertEditable,
  buildVisibilityWhere,
} from './project.access.js';

/** Carga la feria del proyecto y falla si el proyecto no está asociado. */
const requireActiveFair = async (project) => {
  if (!project.fairId) {
    throw ApiError.conflict('El proyecto no está asociado a una feria');
  }
  const fair = await fairRepository.findById(project.fairId);
  if (!fair) throw ApiError.conflict('La feria asociada al proyecto ya no existe');
  return fair;
};

/** La feria debe estar en un estado que permita registrar proyectos. */
const assertFairAcceptsProjectChanges = (fair) => {
  if (!FAIR_REGISTRATION_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La feria está finalizada y no admite modificaciones de proyectos');
  }
};

/** La feria no debe estar finalizada (para revisiones administrativas). */
const assertFairNotClosed = (fair) => {
  if (fair.status === 'CLOSED') {
    throw ApiError.conflict('La feria está finalizada y no admite más revisiones');
  }
};

export const listProjects = async ({ actor, filters = {} }) => {
  const where = buildVisibilityWhere(actor);
  if (filters.status) where.status = filters.status;
  if (filters.fair_id) where.fairId = filters.fair_id;
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const { page, limit, offset } = parsePagination(filters || {});
  const [data, total] = await Promise.all([
    projectRepository.list({ where, skip: offset, take: limit }),
    projectRepository.count(where),
  ]);

  return {
    data: data.map((project) => mapProject(project, actor)),
    pagination: { page, limit, total },
  };
};

export const getProjectById = async ({ projectId, actor }) => {
  const project = await projectRepository.findByIdWithMembers(projectId);
  if (!project) throw ApiError.notFound('Proyecto no encontrado');

  assertTenantMatch({ project, actor });

  if (!isOrgAdmin(actor) && project.createdById !== actor.id) {
    if (project.status !== 'APPROVED') {
      throw ApiError.forbidden('No tienes permiso para ver este proyecto');
    }
  }
  return mapProject(project, actor);
};

export const createProject = async ({ data, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  const fair = await fairRepository.findById(data.fair_id);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.badRequest('La feria no pertenece a tu organización');
  }
  assertFairAcceptsProjectChanges(fair);

  const project = await projectRepository.create({
    organizationId: actor.organizationId,
    fairId: data.fair_id,
    createdById: actor.id,
    name: data.name,
    description: data.description ?? null,
    logoUrl: data.logo_url ?? null,
    coverUrl: data.cover_url ?? null,
    projectUrl: data.project_url ?? null,
    status: 'DRAFT',
  });
  return mapProject(project, actor);
};

export const updateProject = async ({ projectId, data, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });
  assertEditable(project);

  // Cambiar la feria solo si pertenece a la misma organización.
  let nextOrganizationId = project.organizationId;
  if (data.fair_id !== undefined && data.fair_id !== project.fairId) {
    const fair = await fairRepository.findById(data.fair_id);
    if (!fair) throw ApiError.notFound('Feria no encontrada');
    if (fair.organizationId !== project.organizationId) {
      throw ApiError.conflict('La feria debe pertenecer a la misma organización que el proyecto');
    }
    assertFairAcceptsProjectChanges(fair);
    nextOrganizationId = fair.organizationId;
  }

  // Editar un proyecto REJECTED lo devuelve a DRAFT.
  const wasRejected = project.status === 'REJECTED';

  const updated = await projectRepository.update(projectId, {
    ...(data.fair_id !== undefined ? { fairId: data.fair_id, organizationId: nextOrganizationId } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.logo_url !== undefined ? { logoUrl: data.logo_url || null } : {}),
    ...(data.cover_url !== undefined ? { coverUrl: data.cover_url || null } : {}),
    ...(data.project_url !== undefined ? { projectUrl: data.project_url || null } : {}),
    ...(wasRejected
      ? { status: 'DRAFT', reviewedById: null, reviewNotes: null, reviewedAt: null }
      : {}),
  });
  return mapProject(updated, actor);
};

export const submitProject = async ({ projectId, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });

  if (project.status === 'SUBMITTED') {
    throw ApiError.conflict('El proyecto ya está en revisión');
  }
  if (project.status === 'APPROVED') {
    throw ApiError.conflict('El proyecto ya fue aprobado y no puede reenviarse');
  }

  assertFairAcceptsProjectChanges(await requireActiveFair(project));

  const updated = await projectRepository.update(projectId, {
    status: 'SUBMITTED',
    submittedAt: new Date(),
    reviewedById: null,
    reviewNotes: null,
    reviewedAt: null,
  });
  return mapProject(updated, actor);
};

export const reviewProject = async ({ projectId, data, actor }) => {
  if (!REVIEWER_ROLES.includes(actor.role)) {
    throw ApiError.forbidden('Solo el administrador puede revisar proyectos');
  }

  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });

  if (project.status !== 'SUBMITTED') {
    throw ApiError.conflict('El proyecto debe estar en revisión para aprobarse o rechazarse');
  }
  if (data.decision === 'REJECTED' && (!data.review_notes || data.review_notes.length === 0)) {
    throw ApiError.badRequest('Debes indicar el motivo del rechazo');
  }

  assertFairNotClosed(await requireActiveFair(project));

  const updated = await projectRepository.update(projectId, {
    status: data.decision,
    reviewedById: actor.id,
    reviewedAt: new Date(),
    reviewNotes: data.review_notes ?? null,
  });
  return mapProject(updated, actor);
};
