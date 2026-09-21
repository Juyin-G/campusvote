// src/modules/fairEvaluations/fairEvaluation.exposition.service.js
// Proyección + declaración + progreso + listado de proyectos (CHECKLIST).
// Separado del service principal para mantener archivos <= 300 líneas.

import * as evaluationRepository from './fairEvaluation.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { mapEvaluation, mapDeclaration } from './fairEvaluation.helpers.js';
import { getJuryCategoryIds } from '../../shared/helpers/juryCategoryAccess.js';

// Parte 3 — Estados de la feria: participación del JURY SOLO en OPEN.
const RUBRIC_RESPOND_STATUSES = ['OPEN'];
const EVALUABLE_PROJECT_STATUS = ['APPROVED'];
const DECLARATION_ALLOWED_STATUSES = ['OPEN'];

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

const assertTenantMatch = ({ fair, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

const assertJuryAssignedToFair = async ({ fairId, juryId }) => {
  const a = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!a) throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  return a;
};

const assertRubricOpenForResponse = (fair) => {
  if (!RUBRIC_RESPOND_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('Solo puedes responder la rúbrica mientras la feria está abierta (OPEN)');
  }
};

/** El JURY solo puede VER proyectos evaluables con la feria en OPEN. */
const assertJuryFairOpen = (fair) => {
  if (fair.status !== 'OPEN') {
    throw ApiError.conflict('Solo puedes consultar proyectos mientras la feria está abierta (OPEN)');
  }
};

// ── Mappers específicos ──────────────────────────────────────────

const mapApprovedProject = (p) => ({
  id: p.id,
  fair_id: p.fairId,
  name: p.name,
  description: p.description,
  status: p.status,
  created_by: p.createdBy
    ? { id: p.createdBy.id, first_name: p.createdBy.firstName, last_name: p.createdBy.lastName }
    : null,
});

const mapProjectReview = (p) => ({
  project_id: p.id,
  fair_id: p.fairId,
  name: p.name,
  description: p.description,
  logo_url: p.logoUrl,
  cover_url: p.coverUrl,
  project_url: p.projectUrl,
  status: p.status,
  category: p.category ? { id: p.category.id, name: p.category.name } : null,
  stand: p.stand ? { id: p.stand.id, code: p.stand.code } : null,
  members: (p.members || []).map((m) => ({
    id: m.id,
    first_name: m.user?.firstName ?? null,
    last_name: m.user?.lastName ?? null,
    role: m.role,
  })),
});

// ── Proyectos evaluables ────────────────────────────────────────

export const listApprovedProjects = async ({ fairId, actor, filters = {} }) => {
  const fair = await loadFair(fairId);
  let juryCategoryIds = null;
  if (actor.role === ROLES.JURY) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
    assertJuryFairOpen(fair);
    juryCategoryIds = await getJuryCategoryIds(fairId, actor.id);
    if (juryCategoryIds.length === 0) {
      return {
        fair_id: fairId,
        fair_status: fair.status,
        data: [],
        pagination: { page: 1, limit: 20, total: 0 },
      };
    }
  } else {
    assertTenantMatch({ fair, actor });
  }
  const where = { fairId, status: { in: EVALUABLE_PROJECT_STATUS } };
  if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
  if (filters.category_id) where.categoryId = filters.category_id;
  if (filters.stand_id) where.standId = filters.stand_id;

  // Si es JURY, filtrar solo por sus categorías asignadas.
  if (juryCategoryIds !== null) {
    where.categoryId = { in: juryCategoryIds };
  }

  const { page, limit, offset } = parsePagination(filters || {});
  const [data, total] = await Promise.all([
    projectRepository.list({ where, skip: offset, take: limit }),
    projectRepository.count(where),
  ]);

  return {
    fair_id: fairId,
    fair_status: fair.status,
    data: data.map(mapApprovedProject),
    pagination: { page, limit, total },
  };
};

export const getProjectDetail = async ({ fairId, projectId, actor }) => {
  const fair = await loadFair(fairId);
  if (actor.role === ROLES.JURY) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
    assertJuryFairOpen(fair);
    // Verificar categoría del JURY sobre el proyecto.
    const { assertJuryCanOperateOnProject } = await import('../../shared/helpers/juryCategoryAccess.js');
    await assertJuryCanOperateOnProject({ fairId, projectId, actor });
  } else {
    assertTenantMatch({ fair, actor });
  }
  const project = await projectRepository.findByIdWithMembers(projectId);
  if (!project || String(project.fairId) !== String(fairId)) {
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  if (!EVALUABLE_PROJECT_STATUS.includes(project.status)) {
    throw ApiError.notFound('El proyecto no está aprobado para evaluación');
  }
  return mapProjectReview(project);
};

// ── Evaluaciones (consulta) ──────────────────────────────────────

export const listEvaluations = async ({ fairId, actor, filters = {} }) => {
  const fair = await loadFair(fairId);
  const isJuryReader = actor.role === ROLES.JURY;

  if (isJuryReader) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const where = {
    fairId,
    ...(isJuryReader ? { juryUserId: actor.id } : {}),
    ...(!isJuryReader && filters.project_id ? { projectId: filters.project_id } : {}),
    ...(!isJuryReader && filters.jury_user_id ? { juryUserId: filters.jury_user_id } : {}),
  };
  const { page, limit, offset } = parsePagination(filters || {});
  const [data, total] = await Promise.all([
    evaluationRepository.listEvaluations({ ...where, skip: offset, take: limit }),
    evaluationRepository.countEvaluations(where),
  ]);
  return {
    fair_id: fairId,
    data: data.map(mapEvaluation),
    pagination: { page, limit, total },
  };
};

export const listMyEvaluations = async ({ actor, filters = {} }) => {
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo un usuario con rol JURY puede consultar sus evaluaciones');
  }
  const { page, limit, offset } = parsePagination(filters || {});
  const where = { juryUserId: actor.id, ...(filters.fair_id ? { fairId: filters.fair_id } : {}) };
  const [data, total] = await Promise.all([
    evaluationRepository.listEvaluations({ ...where, skip: offset, take: limit }),
    evaluationRepository.countEvaluations(where),
  ]);
  return { data: data.map(mapEvaluation), pagination: { page, limit, total } };
};

// ── Declaración de jurado (JURY) ────────────────────────────────

const assertDeclarationPeriod = (fair) => {
  if (!DECLARATION_ALLOWED_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La declaración del jurado solo se registra mientras la feria está abierta (OPEN)');
  }
};

export const createMyDeclaration = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  assertDeclarationPeriod(fair);

  const existing = await evaluationRepository.findDeclaration(fairId, actor.id);
  if (existing) throw ApiError.conflict('Ya has firmado la declaración de jurado para esta feria');

  try {
    const declaration = await evaluationRepository.safeCreateDeclaration({
      fairId,
      juryUserId: actor.id,
      statement: data.statement,
    });
    return mapDeclaration(declaration);
  } catch (err) {
    if (err.message === 'FAIR_JURY_DECLARATION_ALREADY_EXISTS') {
      throw ApiError.conflict('Ya has firmado la declaración de jurado para esta feria');
    }
    throw err;
  }
};

export const getMyDeclaration = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  const declaration = await evaluationRepository.findDeclaration(fairId, actor.id);
  return {
    fair_id: fairId,
    signed: Boolean(declaration),
    declaration: declaration ? mapDeclaration(declaration) : null,
  };
};

// ── Mi avance (JURY) ─────────────────────────────────────────────

export const getMyProgress = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  const declaration = await evaluationRepository.findDeclaration(fairId, actor.id);
  const totalProjects = await projectRepository.count({
    fairId,
    status: { in: EVALUABLE_PROJECT_STATUS },
  });
  const finalized = await evaluationRepository.countEvaluations({
    fairId,
    juryUserId: actor.id,
    // Nota: la rúbrica finalizada = submittedAt NOT NULL
  });
  // Contamos hojas finalizadas (submittedAt != null) explícitamente:
  const finalizedRows = await evaluationRepository.listEvaluations({
    fairId,
    juryUserId: actor.id,
    take: 1000,
  });
  const finalizedCount = finalizedRows.filter((e) => e.submittedAt).length;

  const remaining = Math.max(0, totalProjects - finalizedCount);
  const progressPercentage =
    totalProjects === 0 ? 0 : Math.round((finalizedCount / totalProjects) * 100);

  return {
    fair_id: fairId,
    fair_name: fair.name,
    fair_status: fair.status,
    declaration: declaration ? mapDeclaration(declaration) : null,
    total_projects: totalProjects,
    completed_projects: finalizedCount,
    pending_projects: remaining,
    progress_percentage: progressPercentage,
    has_voted: false, // El voto anónimo se consulta vía fairVoting/status
  };
};

export default {
  listApprovedProjects,
  getProjectDetail,
  listEvaluations,
  listMyEvaluations,
  createMyDeclaration,
  getMyDeclaration,
  getMyProgress,
};
