// src/modules/projects/project.access.js
// Helpers de acceso: carga, tenant, ownership, mapeos.
// Sin reglas de negocio ni HTTP. Reutilizado por todos los sub-services.

import * as projectRepository from './project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

export const REVIEWER_ROLES = [ROLES.ADMIN];
export const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];
export const FAIR_REGISTRATION_STATUSES = ['DRAFT', 'OPEN'];

export const isOrgAdmin = (actor) => actor.role === ROLES.ADMIN;

// ── Mappers ────────────────────────────────────────────────────────

export const mapProfile = (profile) =>
  profile
    ? {
        id: profile.id,
        first_name: profile.firstName,
        last_name: profile.lastName,
        institutional_id: profile.institutionalId,
        role: profile.role,
      }
    : null;

export const mapMember = (member) => ({
  id: member.id,
  user_id: member.userId,
  role: member.role,
  created_at: member.createdAt,
  user: mapProfile(member.user),
});

export const mapProject = (project, actor = null) => ({
  id: project.id,
  organization_id: project.organizationId,
  fair_id: project.fairId,
  fair: project.fair
    ? { id: project.fair.id, name: project.fair.name, status: project.fair.status }
    : null,
  created_by: mapProfile(project.createdBy),
  name: project.name,
  description: project.description,
  logo_url: project.logoUrl,
  cover_url: project.coverUrl,
  project_url: project.projectUrl,
  status: project.status,
  review_notes: project.reviewNotes,
  reviewed_by: project.reviewedById,
  reviewed_at: project.reviewedAt,
  submitted_at: project.submittedAt,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
  members: project.members ? project.members.map(mapMember) : undefined,
  is_owner: actor ? project.createdById === actor.id : undefined,
});

// ── Helpers de carga ───────────────────────────────────────────────

export const loadProject = async (projectId) => {
  const project = await projectRepository.findById(projectId);
  if (!project) throw ApiError.notFound('Proyecto no encontrado');
  return project;
};

/** Tenant: el actor pertenece a la organización del proyecto. */
export const assertTenantMatch = ({ project, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (project.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('El proyecto no pertenece a tu organización');
  }
};

export const assertOwner = ({ project, actor }) => {
  if (project.createdById !== actor.id) {
    throw ApiError.forbidden('Solo el propietario del proyecto puede realizar esta acción');
  }
};

export const assertEditable = (project) => {
  if (!EDITABLE_STATUSES.includes(project.status)) {
    throw ApiError.conflict('El proyecto no está en un estado editable');
  }
};

/** Filtro de visibilidad para listar proyectos según el actor. */
export const buildVisibilityWhere = (actor) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (isOrgAdmin(actor)) {
    return { organizationId: actor.organizationId };
  }
  return {
    organizationId: actor.organizationId,
    OR: [{ createdById: actor.id }, { status: 'APPROVED' }],
  };
};
