// src/modules/fairEvaluations/fairEvaluation.controller.js
// Capa HTTP del módulo de rúbrica CHECKLIST y hojas de respuesta.

import * as rubricService from './fairEvaluation.service.js';
import * as expositionService from './fairEvaluation.exposition.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;
const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
});

// ── Rúbrica (ADMIN) ──────────────────────────────────────────────

export const createRubric = asyncHandler(async (req, res) =>
  sendCreated(res, await rubricService.createRubric({ fairId: req.params.id, data: req.body, actor: getActor(req.user) }), 'Rúbrica creada correctamente')
);

export const getRubric = asyncHandler(async (req, res) =>
  sendSuccess(res, await rubricService.getRubricForActor({ fairId: req.params.id, actor: getActor(req.user) }), 'Rúbrica obtenida correctamente', {}, HTTP_STATUS.OK)
);

export const updateRubric = asyncHandler(async (req, res) =>
  sendSuccess(res, await rubricService.updateRubric({ fairId: req.params.id, data: req.body, actor: getActor(req.user) }), 'Rúbrica actualizada correctamente', {}, HTTP_STATUS.OK)
);

export const addCriterion = asyncHandler(async (req, res) =>
  sendCreated(res, await rubricService.addCriterion({ fairId: req.params.id, data: req.body, actor: getActor(req.user) }), 'Criterio agregado correctamente')
);

export const updateCriterion = asyncHandler(async (req, res) =>
  sendSuccess(res, await rubricService.updateCriterion({ fairId: req.params.id, criterionId: req.params.criterionId, data: req.body, actor: getActor(req.user) }), 'Criterio actualizado correctamente', {}, HTTP_STATUS.OK)
);

export const removeCriterion = asyncHandler(async (req, res) =>
  sendSuccess(res, await rubricService.removeCriterion({ fairId: req.params.id, criterionId: req.params.criterionId, actor: getActor(req.user) }), 'Criterio eliminado correctamente', {}, HTTP_STATUS.OK)
);

// ── Respuestas de rúbrica (JURY) — CHECKLIST ───────────────────

export const upsertChecklist = asyncHandler(async (req, res) => {
  const result = await rubricService.upsertChecklist({
    fairId: req.params.id,
    projectId: req.params.projectId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, req.body.finalize ? 'Rúbrica finalizada correctamente' : 'Respuestas guardadas correctamente', {}, HTTP_STATUS.OK);
});

export const getMyChecklist = asyncHandler(async (req, res) =>
  sendSuccess(res, await rubricService.getMyChecklist({ fairId: req.params.id, projectId: req.params.projectId, actor: getActor(req.user) }), 'Hoja de rúbrica obtenida correctamente', {}, HTTP_STATUS.OK)
);

// ── Proyectos evaluables (compartido ADMIN/JURY) ────────────────

export const listApprovedProjects = asyncHandler(async (req, res) => {
  const result = await expositionService.listApprovedProjects({ fairId: req.params.id, actor: getActor(req.user), filters: req.query });
  return sendPaginated(res, result.data, result.pagination, 'Proyectos evaluables obtenidos correctamente');
});

export const getProjectDetail = asyncHandler(async (req, res) =>
  sendSuccess(res, await expositionService.getProjectDetail({ fairId: req.params.id, projectId: req.params.projectId, actor: getActor(req.user) }), 'Proyecto obtenido correctamente', {}, HTTP_STATUS.OK)
);

// ── Evaluaciones (consulta) ──────────────────────────────────────

export const listEvaluations = asyncHandler(async (req, res) => {
  const result = await expositionService.listEvaluations({ fairId: req.params.id, actor: getActor(req.user), filters: req.query });
  return sendPaginated(res, result.data, result.pagination, 'Hojas de rúbrica obtenidas correctamente');
});

export const listMyEvaluations = asyncHandler(async (req, res) => {
  const result = await expositionService.listMyEvaluations({ actor: getActor(req.user), filters: req.query });
  return sendPaginated(res, result.data, result.pagination, 'Mis hojas de rúbrica obtenidas correctamente');
});

// ── Declaración de jurado ───────────────────────────────────────

export const createMyDeclaration = asyncHandler(async (req, res) =>
  sendCreated(res, await expositionService.createMyDeclaration({ fairId: req.params.id, data: req.body, actor: getActor(req.user) }), 'Declaración de jurado registrada correctamente')
);

export const getMyDeclaration = asyncHandler(async (req, res) =>
  sendSuccess(res, await expositionService.getMyDeclaration({ fairId: req.params.id, actor: getActor(req.user) }), 'Declaración de jurado obtenida correctamente', {}, HTTP_STATUS.OK)
);

// ── Mi avance (JURY) ─────────────────────────────────────────────

export const getMyProgress = asyncHandler(async (req, res) =>
  sendSuccess(res, await expositionService.getMyProgress({ fairId: req.params.fairId, actor: getActor(req.user) }), 'Avance obtenido correctamente', {}, HTTP_STATUS.OK)
);

export default {
  createRubric,
  getRubric,
  updateRubric,
  addCriterion,
  updateCriterion,
  removeCriterion,
  upsertChecklist,
  getMyChecklist,
  listApprovedProjects,
  getProjectDetail,
  listEvaluations,
  listMyEvaluations,
  createMyDeclaration,
  getMyDeclaration,
  getMyProgress,
};
