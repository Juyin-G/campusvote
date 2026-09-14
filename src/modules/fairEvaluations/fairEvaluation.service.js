// src/modules/fairEvaluations/fairEvaluation.service.js
// Rúbricas y evaluaciones de proyectos de FERIAS (dominio exclusivo de ferias;
// NO mezcla con ratings electorales). Estructura:
//   Fair ── FairRubric ── RubricCriterion
//   Fair ── FairEvaluation (fair + project APPROVED + jury asignado) ── Details
//
// Estados:
//   - La rúbrica SOLO se configura en DRAFT (se congela en OPEN; lectura en
//     CLOSED) para que todos los jurados evalúen bajo las mismas reglas.
//   - Las evaluaciones solo en OPEN y desde que inicia la feria (starts_at);
//     en CLOSED quedan en modo lectura.
//   - Solo proyectos APPROVED y de la MISMA feria son evaluables.
//
// Autorización:
//   - ADMIN/SUPERADMIN gestionan la rúbrica y consultan evaluaciones de SUS
//     ferias (SUPERADMIN conserva el bypass de tenant del sistema).
//   - JURY: consulta la rúbrica y proyectos APPROVED SOLO de ferias donde está
//     formalmente asignado; crea/actualiza SU PROPIA evaluación mientras la
//     feria está OPEN y sigue asignado. NO elimina, NO toca evaluaciones ajenas.
//   - STUDENT/TEACHER/ELECTORAL_COMMISSION/EXPOSITOR/OBSERVER: sin acceso.

import * as evaluationRepository from './fairEvaluation.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { hasFairStarted } from '../fairs/fair.registration.js';

const RUBRIC_CONFIGURABLE_STATUSES = ['DRAFT'];
const EVALUATION_ALLOWED_STATUS = ['OPEN'];
const DECLARATION_ALLOWED_STATUSES = ['DRAFT', 'OPEN'];
const EVALUABLE_PROJECT_STATUS = ['APPROVED'];

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

// ── Helpers de acceso ──────────────────────────────────────────────

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

/** Tenant: ADMIN gestiona solo ferias de su organización (SUPERADMIN bypass). */
const assertTenantMatch = ({ fair, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

/** El actor (JURY) tiene una asignación formal vigente en la feria. */
const assertJuryAssignedToFair = async ({ fairId, juryId }) => {
  const assignment = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  }
  return assignment;
};

/** La declaración se firma mientras la feria se configura o está abierta. */
const assertDeclarationPeriod = (fair) => {
  if (!DECLARATION_ALLOWED_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La declaración del jurado solo se registra en estado DRAFT u OPEN');
  }
};

/** La evaluación EXIGE la declaración de imparcialidad previa del jurado. */
const assertJuryDeclaredForFair = async ({ fairId, juryId }) => {
  const declaration = await evaluationRepository.findDeclaration(fairId, juryId);
  if (!declaration) {
    throw ApiError.conflict(
      'Debes firmar la declaración de jurado antes de registrar una evaluación en esta feria'
    );
  }
  return declaration;
};

const assertRubricConfigurable = (fair) => {
  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict(
      'La rúbrica de la feria solo se puede configurar en estado DRAFT; se congela al abrir la feria'
    );
  }
};

const assertEvaluationOpen = (fair) => {
  if (!EVALUATION_ALLOWED_STATUS.includes(fair.status)) {
    throw ApiError.conflict('Las evaluaciones solo se registran mientras la feria está abierta (OPEN)');
  }
  // El jurado califica la versión final: la evaluación empieza con la feria.
  if (!hasFairStarted(fair)) {
    throw ApiError.conflict('Las evaluaciones empiezan cuando inicia la feria');
  }
};

const loadRubric = async (fairId) => {
  const rubric = await evaluationRepository.findRubricByFair(fairId);
  if (!rubric) {
    throw ApiError.notFound('La feria aún no tiene una rúbrica configurada');
  }
  return rubric;
};

const ensureRubricHasCriteria = (rubric) => {
  if (!rubric.criteria || rubric.criteria.length === 0) {
    throw ApiError.conflict('La rúbrica de la feria aún no tiene criterios configurados');
  }
};

// ── Mappers ────────────────────────────────────────────────────────

const mapCriterion = (c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  min_score: Number(c.minScore),
  max_score: Number(c.maxScore),
  position: c.position,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

const mapRubric = (rubric) => ({
  id: rubric.id,
  fair_id: rubric.fairId,
  name: rubric.name,
  description: rubric.description,
  created_at: rubric.createdAt,
  updated_at: rubric.updatedAt,
  criteria: (rubric.criteria || []).map(mapCriterion),
});

const mapEvaluation = (e) => ({
  id: e.id,
  fair_id: e.fairId,
  project_id: e.projectId,
  rubric_id: e.rubricId,
  total_score: Number(e.totalScore),
  comment: e.comment,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
  project: e.project
    ? {
        id: e.project.id,
        name: e.project.name,
        description: e.project.description,
        status: e.project.status,
      }
    : null,
  jury: e.jury
    ? {
        id: e.jury.id,
        first_name: e.jury.firstName,
        last_name: e.jury.lastName,
        institutional_id: e.jury.institutionalId,
      }
    : null,
  details: (e.details || []).map((d) => ({
    id: d.id,
    criterion_id: d.criterionId,
    criterion_name: d.criterion?.name ?? null,
    min_score: d.criterion ? Number(d.criterion.minScore) : null,
    max_score: d.criterion ? Number(d.criterion.maxScore) : null,
    score: Number(d.score),
  })),
});

// ── Validación de puntuaciones contra la rúbrica de la feria ───────

/**
 * Valida que las puntuaciones cubran EXACTAMENTE todos los criterios de la
 * rúbrica de la feria (nada falta ni sobra) y que cada score respete el rango
 * [min_score, max_score] del criterio. Nunca se acepta una rúbrica enviada por
 * el cliente: el backend la resuelve vía FAIR ─ FairRubric.
 */
const normalizeScores = ({ rubricId, criteria, scores }) => {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const seen = new Set();

  if (scores.length !== criteria.length) {
    const missing = criteria
      .filter((c) => !scores.some((s) => String(s.criterion_id) === String(c.id)))
      .map((c) => c.name);
    const extra = scores.filter((s) => !byId.has(String(s.criterion_id))).length;
    throw ApiError.badRequest(
      `Debes calificar todos los criterios de la rúbrica. Faltan: ${missing.join(', ') || 'ninguno'}` +
        (extra ? ` · ${extra} criterio(s) no pertenecen a esta rúbrica.` : '')
    );
  }

  return scores.map((s) => {
    const criterion = byId.get(String(s.criterion_id));
    if (!criterion) {
      throw ApiError.badRequest('Uno de los criterios no pertenece a la rúbrica de esta feria');
    }
    if (seen.has(String(s.criterion_id))) {
      throw ApiError.badRequest('No puedes enviar un criterio duplicado');
    }
    seen.add(String(s.criterion_id));

    const min = Number(criterion.minScore);
    const max = Number(criterion.maxScore);
    if (!Number.isNaN(s.score) && s.score >= min && s.score <= max) {
      return { criterionId: s.criterion_id, rubricId, score: s.score };
    }
    throw ApiError.badRequest(
      `La puntuación de "${criterion.name}" debe estar entre ${min} y ${max}`
    );
  });
};

// ── Proyectos evaluables ────────────────────────────────────────────

// Incluye portada, categoría y stand para que la lista (tarjetas de la app del
// jurado) no tenga que pedir el detalle de cada proyecto.
const mapApprovedProject = (p) => ({
  id: p.id,
  fair_id: p.fairId,
  name: p.name,
  description: p.description,
  logo_url: p.logoUrl ?? null,
  cover_url: p.coverUrl ?? null,
  status: p.status,
  category: p.category ? { id: p.category.id, name: p.category.name } : null,
  stand: p.stand ? { id: p.stand.id, code: p.stand.code } : null,
  created_by: p.createdBy
    ? { id: p.createdBy.id, first_name: p.createdBy.firstName, last_name: p.createdBy.lastName }
    : null,
});

// Detalle de proyecto para revisión del JURY / lectura de resultados. NO crea
// ProjectReview y NO expone datos personales innecesarios: solo la información
// existente del proyecto (logo/portada/url) e integrantes (id + nombres + rol
// DENTRO del proyecto). Incluye la categoría y el stand de la feria.
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

// =====================================================================
// RÚBRICA (ADMIN/SUPERADMIN)
// =====================================================================

export const createRubric = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);

  const existing = await evaluationRepository.findRubricByFair(fairId);
  if (existing) {
    throw ApiError.conflict('La feria ya tiene una rúbrica configurada');
  }

  const rubric = await evaluationRepository.createRubric({
    fairId,
    name: data.name,
    description: data.description ?? null,
  });

  return {
    id: rubric.id,
    fair_id: fairId,
    name: data.name,
    description: data.description ?? null,
    criteria: [],
  };
};

export const updateRubric = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);

  const current = await loadRubric(fairId);

  const updated = await evaluationRepository.updateRubric(fairId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
  });

  return mapRubric({ ...current, ...updated, criteria: current.criteria });
};

export const getRubric = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);

  if (actor.role === ROLES.JURY && !isSuperAdmin(actor)) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const rubric = await loadRubric(fairId);
  return mapRubric(rubric);
};

export const addCriterion = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);

  const rubric = await loadRubric(fairId);

  const minScore = Number(data.min_score);
  const maxScore = Number(data.max_score);
  if (minScore >= 0 && maxScore > 0 && minScore <= maxScore) {
    // ok
  } else {
    throw ApiError.badRequest('La puntuación mínima debe ser menor o igual a la máxima');
  }

  const position = data.position ?? (await evaluationRepository.nextCriterionPosition(rubric.id));

  try {
    const criterion = await evaluationRepository.createCriterion({
      rubricId: rubric.id,
      name: data.name,
      description: data.description ?? null,
      minScore,
      maxScore,
      position,
    });
    return mapCriterion(criterion);
  } catch (err) {
    if (err.message === 'FAIR_EVALUATION_UNIQUE_CONSTRAINT' || err?.code === 'P2002') {
      throw ApiError.conflict('Ya existe un criterio en esa posición; reordena la rúbrica');
    }
    throw err;
  }
};

export const updateCriterion = async ({ fairId, criterionId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);

  const rubric = await loadRubric(fairId);
  const current = await evaluationRepository.findCriterion(criterionId, rubric.id);
  if (!current) {
    throw ApiError.notFound('Criterio no encontrado en la rúbrica de esta feria');
  }

  const nextMin = data.min_score !== undefined ? Number(data.min_score) : Number(current.minScore);
  const nextMax = data.max_score !== undefined ? Number(data.max_score) : Number(current.maxScore);
  if (!(nextMin >= 0 && nextMax > 0 && nextMin <= nextMax)) {
    throw ApiError.badRequest('La puntuación mínima debe ser menor o igual a la máxima');
  }

  try {
    const updated = await evaluationRepository.updateCriterion(criterionId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.min_score !== undefined ? { minScore: nextMin } : {}),
      ...(data.max_score !== undefined ? { maxScore: nextMax } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
    });
    return mapCriterion(updated);
  } catch (err) {
    if (err?.code === 'P2002') {
      throw ApiError.conflict('Ya existe un criterio en esa posición');
    }
    throw err;
  }
};

export const removeCriterion = async ({ fairId, criterionId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);

  const rubric = await loadRubric(fairId);
  const current = await evaluationRepository.findCriterion(criterionId, rubric.id);
  if (!current) {
    throw ApiError.notFound('Criterio no encontrado en la rúbrica de esta feria');
  }

  await evaluationRepository.deleteCriterion(criterionId);
  return { deleted: true, fair_id: fairId, criterion_id: criterionId };
};

// =====================================================================
// PROYECTOS EVALUABLES (consulta)
// =====================================================================

export const listApprovedProjects = async ({ fairId, actor, filters = {} }) => {
  const fair = await loadFair(fairId);

  if (actor.role === ROLES.JURY && !isSuperAdmin(actor)) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const where = { fairId, status: { in: EVALUABLE_PROJECT_STATUS } };
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }
  if (filters.category_id) {
    where.categoryId = filters.category_id;
  }
  if (filters.stand_id) {
    where.standId = filters.stand_id;
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

/**
 * GET /api/fairs/:id/projects/:projectId — Detalle de un proyecto de la feria.
 * Consulta COMPARTIDA:
 *   - JURY asignado: revisión previa a su evaluación.
 *   - ADMIN/SUPERADMIN: lectura de la información de UN proyecto (por ejemplo,
 *     desde el ranking/resultados). ADMIN valida tenant; SUPERADMIN bypass.
 * Consulta DERIVADA de Project + ProjectMember; no se persiste ningún
 * ProjectReview ni ProjectDetail. Incluye categoría y stand de la feria.
 */
export const getProjectDetail = async ({ fairId, projectId, actor }) => {
  const fair = await loadFair(fairId);

  if (actor.role === ROLES.JURY && !isSuperAdmin(actor)) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const project = await projectRepository.findByIdWithMembers(projectId);
  if (!project || String(project.fairId) !== String(fairId)) {
    // 404 (no 403) para no revelar la existencia de proyectos de otra feria.
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  if (!EVALUABLE_PROJECT_STATUS.includes(project.status)) {
    throw ApiError.notFound('El proyecto no está aprobado para evaluación');
  }

  return mapProjectReview(project);
};

// =====================================================================
// EVALUACIONES
// =====================================================================

export const createEvaluation = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertEvaluationOpen(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  // Las evaluaciones EXIGEN la declaración de imparcialidad previa.
  await assertJuryDeclaredForFair({ fairId, juryId: actor.id });

  const rubric = await loadRubric(fairId);
  ensureRubricHasCriteria(rubric);

  const project = await projectRepository.findById(data.project_id);
  if (!project) {
    throw ApiError.notFound('Proyecto no encontrado');
  }
  if (project.fairId !== fairId) {
    throw ApiError.badRequest('El proyecto no pertenece a esta feria');
  }
  if (!EVALUABLE_PROJECT_STATUS.includes(project.status)) {
    throw ApiError.conflict('Solo se pueden evaluar proyectos aprobados (APPROVED)');
  }
  // Conflicto de interés: nadie califica un proyecto en el que participa.
  if (project.createdById === actor.id || (await projectRepository.findMember(project.id, actor.id))) {
    throw ApiError.conflict('No puedes evaluar un proyecto en el que participas');
  }

  const existing = await evaluationRepository.findEvaluationByFairProjectJury(fairId, data.project_id, actor.id);
  if (existing) {
    throw ApiError.conflict('Ya tienes una evaluación para este proyecto en esta feria');
  }

  const details = normalizeScores({
    rubricId: rubric.id,
    criteria: rubric.criteria,
    scores: data.scores,
  });

  const totalScore = Number(details.reduce((acc, d) => acc + d.score, 0).toFixed(2));

  try {
    const created = await evaluationRepository.safeCreateEvaluation(
      {
        fairId,
        projectId: data.project_id,
        juryUserId: actor.id,
        rubricId: rubric.id,
        totalScore,
        comment: data.comment ?? null,
      },
      details
    );
    const full = await evaluationRepository.findEvaluation(created.id, fairId);
    return mapEvaluation(full);
  } catch (err) {
    if (err.message === 'FAIR_EVALUATION_ALREADY_EXISTS') {
      throw ApiError.conflict('Ya tienes una evaluación para este proyecto en esta feria');
    }
    throw err;
  }
};

export const updateEvaluation = async ({ fairId, evaluationId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertEvaluationOpen(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  const current = await evaluationRepository.findEvaluation(evaluationId, fairId);
  if (!current) {
    throw ApiError.notFound('Evaluación no encontrada');
  }
  if (current.juryUserId !== actor.id) {
    throw ApiError.forbidden('Solo puedes modificar tus propias evaluaciones');
  }

  let totalScore = Number(current.totalScore);
  let details = [];
  if (data.scores) {
    const rubric = await loadRubric(fairId);
    ensureRubricHasCriteria(rubric);
    details = normalizeScores({
      rubricId: rubric.id,
      criteria: rubric.criteria,
      scores: data.scores,
    });
    totalScore = Number(details.reduce((acc, d) => acc + d.score, 0).toFixed(2));
  }

  const updated = await evaluationRepository.updateEvaluation(
    evaluationId,
    {
      ...(data.scores ? { totalScore } : {}),
      ...(data.comment !== undefined ? { comment: data.comment || null } : {}),
    },
    details
  );

  const full = await evaluationRepository.findEvaluation(updated.id, fairId);
  return mapEvaluation(full);
};

export const listEvaluations = async ({ fairId, actor, filters = {} }) => {
  const fair = await loadFair(fairId);

  const isJuryReader = actor.role === ROLES.JURY && !isSuperAdmin(actor);

  if (isJuryReader) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const where = {
    fairId,
    // JURY solo ve SUS evaluaciones; ADMIN/SUPERADMIN ve todas (+ filtros).
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
  const where = {
    juryUserId: actor.id,
    ...(filters.fair_id ? { fairId: filters.fair_id } : {}),
  };

  const [data, total] = await Promise.all([
    evaluationRepository.listEvaluations({ ...where, skip: offset, take: limit }),
    evaluationRepository.countEvaluations(where),
  ]);

  return {
    data: data.map(mapEvaluation),
    pagination: { page, limit, total },
  };
};

// =====================================================================
// DECLARACIÓN DE JURADO (JURY)
// =====================================================================

const mapDeclaration = (d) => ({
  id: d.id,
  fair_id: d.fairId,
  signed_at: d.signedAt,
  statement: d.statement,
  created_at: d.createdAt,
  updated_at: d.updatedAt,
});

/** POST /api/fairs/:id/jury/declaration — firma la declaración del jurado. */
export const createMyDeclaration = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  assertDeclarationPeriod(fair);

  const existing = await evaluationRepository.findDeclaration(fairId, actor.id);
  if (existing) {
    throw ApiError.conflict('Ya has firmado la declaración de jurado para esta feria');
  }

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

/** GET /api/fairs/:id/jury/declaration — consulta la declaración del jurado. */
export const getMyDeclaration = async ({ fairId, actor }) => {
  await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  const declaration = await evaluationRepository.findDeclaration(fairId, actor.id);
  return {
    fair_id: fairId,
    signed: Boolean(declaration),
    declaration: declaration ? mapDeclaration(declaration) : null,
  };
};

// =====================================================================
// MI AVANCE (JURY)
// =====================================================================

/**
 * GET /api/fairs/:id/my-progress — panel de avance del JURY en la feria:
 * declaración firmada, proyectos APPROVED evaluables, evaluaciones propias,
 * restantes y porcentaje de avance. Todo se DERIVA (no se persiste nada).
 */
export const getMyProgress = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  const declaration = await evaluationRepository.findDeclaration(fairId, actor.id);
  const totalProjects = await projectRepository.count({
    fairId,
    status: { in: EVALUABLE_PROJECT_STATUS },
  });
  const evaluated = await evaluationRepository.countEvaluations({
    fairId,
    juryUserId: actor.id,
  });

  const remaining = Math.max(0, totalProjects - evaluated);
  const progressPercentage =
    totalProjects === 0 ? 0 : Math.round((evaluated / totalProjects) * 100);

  const evaluations = await evaluationRepository.listEvaluations({
    fairId,
    juryUserId: actor.id,
  });

  return {
    fair_id: fairId,
    fair_name: fair.name,
    fair_status: fair.status,
    declaration: declaration ? mapDeclaration(declaration) : null,
    total_projects: totalProjects,
    evaluated_projects: evaluated,
    remaining,
    progress_percentage: progressPercentage,
    evaluations: evaluations.map(mapEvaluation),
  };
};

export default {
  createRubric,
  updateRubric,
  getRubric,
  addCriterion,
  updateCriterion,
  removeCriterion,
  listApprovedProjects,
  getProjectDetail,
  createEvaluation,
  updateEvaluation,
  listEvaluations,
  listMyEvaluations,
  createMyDeclaration,
  getMyDeclaration,
  getMyProgress,
};