// src/modules/projects/project.members.service.js
// Gestión de integrantes (ProjectMember) del proyecto.

import * as projectRepository from './project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  isOrgAdmin,
  loadProject,
  mapMember,
  assertTenantMatch,
  assertOwner,
  assertEditable,
} from './project.access.js';
import * as fairRepository from '../fairs/fair.repository.js';

const FAIR_REGISTRATION_STATUSES = ['DRAFT', 'OPEN'];

const requireActiveFair = async (project) => {
  if (!project.fairId) {
    throw ApiError.conflict('El proyecto no está asociado a una feria');
  }
  const fair = await fairRepository.findById(project.fairId);
  if (!fair) throw ApiError.conflict('La feria asociada al proyecto ya no existe');
  return fair;
};

const assertFairAcceptsProjectChanges = (fair) => {
  if (!FAIR_REGISTRATION_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La feria está finalizada y no admite modificaciones de proyectos');
  }
};

export const listMembers = async ({ projectId, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });

  if (
    !isOrgAdmin(actor) &&
    project.createdById !== actor.id &&
    project.status !== 'APPROVED'
  ) {
    throw ApiError.forbidden('No tienes permiso para ver los integrantes de este proyecto');
  }

  const members = await projectRepository.listMembers(projectId);
  return { project_id: projectId, members: members.map(mapMember) };
};

export const addMember = async ({ projectId, data, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });
  assertEditable(project);
  assertFairAcceptsProjectChanges(await requireActiveFair(project));

  const member = await projectRepository.findUserById(data.user_id);
  if (!member) throw ApiError.notFound('Usuario no encontrado');
  if (member.status !== 'ACTIVE') {
    throw ApiError.conflict('El usuario no está activo');
  }
  if (project.organizationId !== member.organizationId) {
    throw ApiError.badRequest('El usuario no pertenece a la misma organización que el proyecto');
  }

  try {
    const created = await projectRepository.addMember({
      projectId,
      userId: data.user_id,
      role: data.role,
    });
    return mapMember(created);
  } catch (err) {
    if (err.message === 'PROJECT_MEMBER_ALREADY_EXISTS') {
      throw ApiError.conflict('El usuario ya es integrante del proyecto');
    }
    throw err;
  }
};

export const removeMember = async ({ projectId, userId, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });
  assertEditable(project);
  assertFairAcceptsProjectChanges(await requireActiveFair(project));

  const removed = await projectRepository.removeMember(projectId, userId);
  if (!removed) throw ApiError.notFound('El usuario no es integrante del proyecto');

  return { deleted: true, project_id: projectId, user_id: userId };
};
