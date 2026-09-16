// src/modules/projects/project.service.js
// Lógica de negocio de proyectos de feria:
// - El propietario (STUDENT/TEACHER) lo crea en DRAFT, edita, define
//   participantes y lo envía a revisión.
// - El ADMIN de la misma organización lo aprueba o rechaza.
// - EXPOSITOR es una PARTICIPACIÓN (project_members.role), nunca un rol global.
// - Todo proyecto pertenece a una FERIA (fair_id obligatorio). La feria
//   determina la organización del proyecto; organization_id es solo un espejo
//   garantizado por la FK compuesta SQL (fair_id, organization_id).
// - Regla de pertenencia: todo integrante pertenece a la misma organización
//   que el proyecto (user.organizationId === project.organization_id).

import * as projectRepository from './project.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';

const REVIEWER_ROLES = [ROLES.ADMIN];
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];

// Estados de la feria en los que se permite registrar/modificar proyectos.
const FAIR_REGISTRATION_STATUSES = ['DRAFT', 'OPEN'];

const isOrgAdmin = (actor) => actor.role === ROLES.ADMIN;

// ── Helpers de feria ───────────────────────────────────────────────

/** Carga la feria del proyecto y falla si el proyecto no está asociado. */
const requireActiveFair = async (project) => {
  if (!project.fairId) {
    throw ApiError.conflict('El proyecto no está asociado a una feria');
  }
  const fair = await fairRepository.findById(project.fairId);
  if (!fair) {
    throw ApiError.conflict('La feria asociada al proyecto ya no existe');
  }
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

// ── Helpers de mapeo ───────────────────────────────────────────────

const mapProfile = (profile) =>
  profile
    ? {
        id: profile.id,
        first_name: profile.firstName,
        last_name: profile.lastName,
        institutional_id: profile.institutionalId,
        role: profile.role,
      }
    : null;

const mapMember = (member) => ({
  id: member.id,
  user_id: member.userId,
  role: member.role,
  created_at: member.createdAt,
  user: mapProfile(member.user),
});

const mapProject = (project, actor = null) => ({
  id: project.id,
  organization_id: project.organizationId,
  fair_id: project.fairId,
  fair: project.fair
    ? {
        id: project.fair.id,
        name: project.fair.name,
        status: project.fair.status,
      }
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

// ── Helpers de acceso ──────────────────────────────────────────────

const loadProject = async (projectId) => {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw ApiError.notFound('Proyecto no encontrado');
  }
  return project;
};

/** Tenant check: el actor pertenece a la organización del proyecto. */
const assertTenantMatch = ({ project, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (project.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('El proyecto no pertenece a tu organización');
  }
};

const assertOwner = ({ project, actor }) => {
  if (project.createdById !== actor.id) {
    throw ApiError.forbidden('Solo el propietario del proyecto puede realizar esta acción');
  }
};

const assertEditable = (project) => {
  if (!EDITABLE_STATUSES.includes(project.status)) {
    throw ApiError.conflict('El proyecto no está en un estado editable');
  }
};

/** Filtro de visibilidad para listar proyectos según el actor. */
const buildVisibilityWhere = (actor) => {
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

// ── Operaciones del módulo ─────────────────────────────────────────

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
  if (!project) {
    throw ApiError.notFound('Proyecto no encontrado');
  }

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

  // La feria pertenece a la organización del actor y admite registro.
  const fair = await fairRepository.findById(data.fair_id);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
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

  // Cambiar la feria solo si pertenece a la misma organización (nunca se
  // permite mover un proyecto entre organizaciones) y admite registro.
  let nextOrganizationId = project.organizationId;
  if (data.fair_id !== undefined && data.fair_id !== project.fairId) {
    const fair = await fairRepository.findById(data.fair_id);
    if (!fair) {
      throw ApiError.notFound('Feria no encontrada');
    }
    if (fair.organizationId !== project.organizationId) {
      throw ApiError.conflict('La feria debe pertenecer a la misma organización que el proyecto');
    }
    assertFairAcceptsProjectChanges(fair);
    nextOrganizationId = fair.organizationId;
  }

  // Editar un proyecto REJECTED lo devuelve a DRAFT (en edición) y limpia
  // la revisión anterior para permitir volver a enviarlo.
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

  // No se puede enviar un proyecto si su feria está cerrada.
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

  // La revisión se bloquea cuando la feria está finalizada.
  assertFairNotClosed(await requireActiveFair(project));

  const updated = await projectRepository.update(projectId, {
    status: data.decision,
    reviewedById: actor.id,
    reviewedAt: new Date(),
    reviewNotes: data.review_notes ?? null,
  });

  return mapProject(updated, actor);
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
  if (!member) {
    throw ApiError.notFound('Usuario no encontrado');
  }
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
  if (!removed) {
    throw ApiError.notFound('El usuario no es integrante del proyecto');
  }

  return { deleted: true, project_id: projectId, user_id: userId };
};

export default {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
  listMembers,
  addMember,
  removeMember,
};