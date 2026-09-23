// src/modules/projects/project.service.js
// Lógica de negocio de proyectos de feria:
// - El DOCENTE asesor inscribe el proyecto en DRAFT (queda como ADVISOR),
//   agrega a sus alumnos por correo, elige la categoría, edita y lo envía a
//   revisión. Solo él edita el contenido; los integrantes lo ven.
// - El ADMIN de la misma organización revisa que la inscripción esté bien
//   hecha: la aprueba (puede corregir la categoría) o la rechaza con motivo.
// - El ADMIN asigna el stand, solo a proyectos aprobados.
// - EXPOSITOR es una PARTICIPACIÓN (project_members.role), nunca un rol global.
// - Todo proyecto pertenece a una FERIA (fair_id obligatorio). La feria
//   determina la organización del proyecto; organization_id es solo un espejo
//   garantizado por la FK compuesta SQL (fair_id, organization_id).
// - Regla de pertenencia: todo integrante pertenece a la misma organización
//   que el proyecto (user.organizationId === project.organization_id).
// - Un estudiante participa en un solo proyecto por feria.
// - Pasado el cierre de inscripción (fair.registration.js) nadie inscribe,
//   edita, envía ni cambia integrantes.

import * as projectRepository from './project.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { getRegistrationDeadline, isRegistrationClosed } from '../fairs/fair.registration.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { buildPublicRegistrationUrl } from '../fairs/fair.service.js';
import emailService from '../../shared/services/email.service.js';
import logger from '../../config/logger.js';

// El SUPERADMIN administra la plataforma, no los datos de cada institución:
// no revisa, no asigna stands y no ve proyectos (403 por falta de organización).
const REVIEWER_ROLES = [ROLES.ADMIN];
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];

// Estados de la feria en los que se permite registrar/modificar proyectos.
const FAIR_REGISTRATION_STATUSES = ['DRAFT', 'OPEN'];

// Participación con la que queda quien inscribe el proyecto: el docente es el
// asesor; el estudiante que se inscribe a sí mismo es expositor.
const CREATOR_MEMBER_ROLE_BY_USER_ROLE = {
  [ROLES.TEACHER]: 'ADVISOR',
  [ROLES.STUDENT]: 'EXPOSITOR',
};

// Rol global que debe tener cada participación.
const USER_ROLE_BY_MEMBER_ROLE = {
  EXPOSITOR: ROLES.STUDENT,
  COLLABORATOR: ROLES.STUDENT,
  ADVISOR: ROLES.TEACHER,
};

const isOrgAdmin = (actor) => actor.role === ROLES.ADMIN;

/**
 * Avisa por correo el resultado de la revisión a quien inscribió el proyecto.
 * Cuando hay observaciones incluye el motivo y el enlace público para
 * corregirlas. El correo NUNCA hace fallar la revisión: si no se puede enviar
 * (sin Gmail configurado, por ejemplo), queda en el log.
 */
const notifyReviewDecision = async ({ projectId, decision, reviewNotes }) => {
  try {
    const destino = await projectRepository.findReviewRecipient(projectId);
    if (!destino?.createdBy?.email) return;

    const link =
      destino.fair?.publicRegistrationEnabled && destino.fair?.publicToken
        ? buildPublicRegistrationUrl(destino.fair.publicToken)
        : null;

    await emailService.sendProjectReviewNotice({
      email: destino.createdBy.email,
      firstName: destino.createdBy.firstName,
      projectName: destino.name,
      fairName: destino.fair?.name ?? '',
      decision,
      reviewNotes: reviewNotes ?? '',
      link,
    });
  } catch (error) {
    logger.error('No se pudo avisar el resultado de la revisión', {
      projectId,
      error: error.message,
    });
  }
};

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

/** La feria admite registrar proyectos: estado válido y inscripción abierta. */
const assertFairAcceptsProjectChanges = (fair) => {
  if (!FAIR_REGISTRATION_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La feria está finalizada y no admite modificaciones de proyectos');
  }
  if (isRegistrationClosed(fair)) {
    throw ApiError.conflict(
      `La inscripción de proyectos de esta feria cerró el ${getRegistrationDeadline(fair).toISOString()}`
    );
  }
};

/** La feria no debe estar finalizada (para revisiones administrativas). */
const assertFairNotClosed = (fair) => {
  if (fair.status === 'CLOSED') {
    throw ApiError.conflict('La feria está finalizada y no admite más revisiones');
  }
};

/** La categoría existe y pertenece a la feria indicada. */
const assertCategoryOfFair = async ({ categoryId, fairId }) => {
  const category = await projectRepository.findCategoryById(categoryId);
  if (!category) {
    throw ApiError.badRequest('La categoría no existe');
  }
  if (category.fairId !== fairId) {
    throw ApiError.badRequest('La categoría no pertenece a la feria del proyecto');
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
  category_id: project.categoryId,
  category: project.category ? { id: project.category.id, name: project.category.name } : null,
  stand_id: project.standId,
  stand: project.stand ? { id: project.stand.id, code: project.stand.code } : null,
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

const mapCatalogFair = (fair) => ({
  id: fair.id,
  name: fair.name,
  description: fair.description,
  status: fair.status,
  starts_at: fair.startsAt,
  ends_at: fair.endsAt,
  registration_closes_at: getRegistrationDeadline(fair),
  categories: fair.categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
  })),
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
    throw ApiError.forbidden('Solo quien inscribió el proyecto puede realizar esta acción');
  }
};

const assertEditable = (project) => {
  if (!EDITABLE_STATUSES.includes(project.status)) {
    throw ApiError.conflict('El proyecto no está en un estado editable');
  }
};

/** Admin, propietario o integrante: ven el proyecto aunque no esté aprobado. */
const canSeeUnapproved = ({ project, actor, members }) =>
  isOrgAdmin(actor) ||
  project.createdById === actor.id ||
  members.some((m) => m.userId === actor.id);

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
    OR: [
      { createdById: actor.id },
      { status: 'APPROVED' },
      { members: { some: { userId: actor.id } } },
    ],
  };
};

// ── Operaciones del módulo ─────────────────────────────────────────

/** GET /projects/catalog — ferias con la inscripción abierta y sus categorías. */
export const getCatalog = async ({ actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  const fairs = await projectRepository.listOpenFairsWithCategories(actor.organizationId);
  return fairs.filter((fair) => !isRegistrationClosed(fair)).map(mapCatalogFair);
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
  if (!project) {
    throw ApiError.notFound('Proyecto no encontrado');
  }

  assertTenantMatch({ project, actor });

  if (project.status !== 'APPROVED' && !canSeeUnapproved({ project, actor, members: project.members })) {
    throw ApiError.forbidden('No tienes permiso para ver este proyecto');
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

  if (data.category_id) {
    await assertCategoryOfFair({ categoryId: data.category_id, fairId: fair.id });
  }

  const creatorMemberRole = CREATOR_MEMBER_ROLE_BY_USER_ROLE[actor.role];
  if (!creatorMemberRole) {
    throw ApiError.forbidden('Solo un docente o un estudiante puede inscribir un proyecto');
  }

  // Un estudiante participa en un solo proyecto por feria, también cuando es
  // él quien inscribe (la participación del creador no pasa por addMember).
  if (creatorMemberRole === 'EXPOSITOR') {
    const other = await projectRepository.findMembershipInFair({
      fairId: fair.id,
      userId: actor.id,
    });
    if (other) {
      throw ApiError.conflict(
        `Ya participas en el proyecto "${other.project.name}" de esta feria`
      );
    }
  }

  const project = await projectRepository.createWithAdvisor({
    organizationId: actor.organizationId,
    fairId: data.fair_id,
    createdById: actor.id,
    categoryId: data.category_id ?? null,
    name: data.name,
    description: data.description ?? null,
    logoUrl: data.logo_url ?? null,
    coverUrl: data.cover_url ?? null,
    projectUrl: data.project_url ?? null,
    status: 'DRAFT',
  }, creatorMemberRole);

  return mapProject(project, actor);
};

export const updateProject = async ({ projectId, data, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });
  assertEditable(project);
  assertFairAcceptsProjectChanges(await requireActiveFair(project));

  // Cambiar la feria solo si pertenece a la misma organización (nunca se
  // permite mover un proyecto entre organizaciones) y admite registro.
  let nextOrganizationId = project.organizationId;
  const fairChanges = data.fair_id !== undefined && data.fair_id !== project.fairId;
  if (fairChanges) {
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

  // La categoría es de la feria: si la feria cambia y no se indica otra
  // categoría, la anterior deja de ser válida y se quita.
  const targetFairId = fairChanges ? data.fair_id : project.fairId;

  // Los jurados se asignan por categoría: cambiarla con la feria ya abierta
  // dejaría el proyecto fuera del alcance del jurado que lo tenía asignado.
  const categoryChanges =
    data.category_id !== undefined && data.category_id !== project.categoryId;
  if (categoryChanges) {
    const targetFair = await fairRepository.findById(targetFairId);
    if (targetFair && targetFair.status !== 'DRAFT') {
      throw ApiError.conflict(
        'No se puede cambiar la categoría de un proyecto cuando la feria no está en preparación (DRAFT)'
      );
    }
  }

  let categoryChange = {};
  if (data.category_id) {
    await assertCategoryOfFair({ categoryId: data.category_id, fairId: targetFairId });
    categoryChange = { categoryId: data.category_id };
  } else if (data.category_id === null || fairChanges) {
    categoryChange = { categoryId: null };
  }

  // Editar un proyecto REJECTED lo devuelve a DRAFT (en edición) y limpia
  // la revisión anterior para permitir volver a enviarlo.
  const wasRejected = project.status === 'REJECTED';

  const updated = await projectRepository.update(projectId, {
    ...(fairChanges ? { fairId: data.fair_id, organizationId: nextOrganizationId } : {}),
    ...categoryChange,
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

  // No se puede enviar un proyecto si su feria está cerrada o la inscripción terminó.
  const fair = await requireActiveFair(project);
  assertFairAcceptsProjectChanges(fair);

  // Una inscripción completa tiene al menos un expositor y, si la feria
  // clasifica por categorías, la categoría elegida.
  const members = await projectRepository.listMembers(projectId);
  if (!members.some((m) => m.role === 'EXPOSITOR')) {
    throw ApiError.badRequest('Agrega al menos un estudiante como expositor antes de enviar el proyecto');
  }
  if (!project.categoryId && (await projectRepository.countCategoriesByFair(fair.id)) > 0) {
    throw ApiError.badRequest('Elige la categoría del proyecto antes de enviarlo');
  }

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

  if (data.category_id) {
    await assertCategoryOfFair({ categoryId: data.category_id, fairId: project.fairId });
  }

  const updated = await projectRepository.update(projectId, {
    status: data.decision,
    reviewedById: actor.id,
    reviewedAt: new Date(),
    reviewNotes: data.review_notes ?? null,
    ...(data.category_id !== undefined ? { categoryId: data.category_id } : {}),
  });

  await notifyReviewDecision({
    projectId,
    decision: data.decision,
    reviewNotes: data.review_notes,
  });

  return mapProject(updated, actor);
};

/** PUT /projects/:id/stand — el admin asigna (o libera) el stand de un proyecto aprobado. */
export const assignStand = async ({ projectId, data, actor }) => {
  if (!REVIEWER_ROLES.includes(actor.role)) {
    throw ApiError.forbidden('Solo el administrador puede asignar stands');
  }

  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });

  if (project.status !== 'APPROVED') {
    throw ApiError.conflict('Solo se asigna stand a proyectos aprobados');
  }
  assertFairNotClosed(await requireActiveFair(project));

  if (data.stand_id !== null) {
    const stand = await projectRepository.findStandById(data.stand_id);
    if (!stand) {
      throw ApiError.notFound('Stand no encontrado');
    }
    if (stand.fairId !== project.fairId) {
      throw ApiError.badRequest('El stand no pertenece a la feria del proyecto');
    }
  }

  try {
    const updated = await projectRepository.update(projectId, { standId: data.stand_id });
    return mapProject(updated, actor);
  } catch (err) {
    if (err.message === 'PROJECT_UNIQUE_CONSTRAINT') {
      throw ApiError.conflict('El stand ya está asignado a otro proyecto');
    }
    throw err;
  }
};

export const listMembers = async ({ projectId, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });

  const members = await projectRepository.listMembers(projectId);

  if (project.status !== 'APPROVED' && !canSeeUnapproved({ project, actor, members })) {
    throw ApiError.forbidden('No tienes permiso para ver los integrantes de este proyecto');
  }

  return { project_id: projectId, members: members.map(mapMember) };
};

export const addMember = async ({ projectId, data, actor }) => {
  const project = await loadProject(projectId);
  assertTenantMatch({ project, actor });
  assertOwner({ project, actor });
  assertEditable(project);
  assertFairAcceptsProjectChanges(await requireActiveFair(project));

  const member = data.email
    ? await projectRepository.findUserByEmail(data.email)
    : await projectRepository.findUserById(data.user_id);
  if (!member) {
    throw ApiError.notFound(
      data.email ? 'No hay ningún usuario registrado con ese correo' : 'Usuario no encontrado'
    );
  }
  if (member.status !== 'ACTIVE') {
    throw ApiError.conflict('El usuario no está activo');
  }
  if (project.organizationId !== member.organizationId) {
    throw ApiError.badRequest('El usuario no pertenece a la misma organización que el proyecto');
  }

  const requiredRole = USER_ROLE_BY_MEMBER_ROLE[data.role];
  if (member.role !== requiredRole) {
    throw ApiError.badRequest(
      requiredRole === ROLES.STUDENT
        ? 'Solo un estudiante puede participar como expositor o colaborador'
        : 'Solo un docente puede participar como asesor'
    );
  }

  // Un estudiante participa en un solo proyecto por feria (un docente sí
  // puede asesorar varios).
  if (requiredRole === ROLES.STUDENT) {
    const other = await projectRepository.findMembershipInFair({
      fairId: project.fairId,
      userId: member.id,
      excludeProjectId: projectId,
    });
    if (other) {
      throw ApiError.conflict(
        `El estudiante ya participa en el proyecto "${other.project.name}" de esta feria`
      );
    }
  }

  try {
    const created = await projectRepository.addMember({
      projectId,
      userId: member.id,
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

  if (userId === project.createdById) {
    throw ApiError.conflict('No se puede quitar a quien inscribió el proyecto');
  }

  const removed = await projectRepository.removeMember(projectId, userId);
  if (!removed) {
    throw ApiError.notFound('El usuario no es integrante del proyecto');
  }

  return { deleted: true, project_id: projectId, user_id: userId };
};

export default {
  getCatalog,
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
  assignStand,
  listMembers,
  addMember,
  removeMember,
};
