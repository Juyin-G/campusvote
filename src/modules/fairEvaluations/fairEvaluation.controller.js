// src/modules/fairEvaluations/fairEvaluation.controller.js
import * as fairEvalService from './fairEvaluation.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import {
  sendCreated,
  sendSuccess,
  sendPaginated,
} from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// ── Rúbrica (ADMIN) ────────────────────────────────────────────────

// POST /api/fairs/:id/rubric
export const createRubric = asyncHandler(async (req, res) => {
  const rubric = await fairEvalService.createRubric({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, rubric, 'Rúbrica creada correctamente');
});

// GET /api/fairs/:id/rubric (ADMIN/JURY con asignación)
export const getRubric = asyncHandler(async (req, res) => {
  const rubric = await fairEvalService.getRubric({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, rubric, 'Rúbrica obtenida correctamente', {}, HTTP_STATUS.OK);
});

// PUT /api/fairs/:id/rubric
export const updateRubric = asyncHandler(async (req, res) => {
  const rubric = await fairEvalService.updateRubric({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, rubric, 'Rúbrica actualizada correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/rubric/criteria
export const addCriterion = asyncHandler(async (req, res) => {
  const criterion = await fairEvalService.addCriterion({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, criterion, 'Criterio agregado correctamente');
});

// PUT /api/fairs/:id/rubric/criteria/:criterionId
export const updateCriterion = asyncHandler(async (req, res) => {
  const criterion = await fairEvalService.updateCriterion({
    fairId: req.params.id,
    criterionId: req.params.criterionId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, criterion, 'Criterio actualizado correctamente', {}, HTTP_STATUS.OK);
});

// DELETE /api/fairs/:id/rubric/criteria/:criterionId
export const removeCriterion = asyncHandler(async (req, res) => {
  const result = await fairEvalService.removeCriterion({
    fairId: req.params.id,
    criterionId: req.params.criterionId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Criterio eliminado correctamente', {}, HTTP_STATUS.OK);
});

// ── Proyectos evaluables ────────────────────────────────────────────

// GET /api/fairs/:id/projects
export const listApprovedProjects = asyncHandler(async (req, res) => {
  const result = await fairEvalService.listApprovedProjects({
    fairId: req.params.id,
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Proyectos evaluables obtenidos correctamente');
});

// GET /api/fairs/:id/projects/:projectId (detalle compartido JURY/ADMIN)
export const getProjectDetail = asyncHandler(async (req, res) => {
  const result = await fairEvalService.getProjectDetail({
    fairId: req.params.id,
    projectId: req.params.projectId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Proyecto obtenido correctamente', {}, HTTP_STATUS.OK);
});

// ── Evaluaciones ────────────────────────────────────────────────────

// GET /api/fairs/:id/evaluations (ADMIN todas / JURY solo las suyas)
export const listEvaluations = asyncHandler(async (req, res) => {
  const result = await fairEvalService.listEvaluations({
    fairId: req.params.id,
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Evaluaciones obtenidas correctamente');
});

// POST /api/fairs/:id/evaluations (JURY)
export const createEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await fairEvalService.createEvaluation({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, evaluation, 'Evaluación registrada correctamente');
});

// PUT /api/fairs/:id/evaluations/:evaluationId (JURY sobre la suya)
export const updateEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await fairEvalService.updateEvaluation({
    fairId: req.params.id,
    evaluationId: req.params.evaluationId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, evaluation, 'Evaluación actualizada correctamente', {}, HTTP_STATUS.OK);
});

// GET /api/fairs/my-evaluations (JURY: solo las suyas)
export const listMyEvaluations = asyncHandler(async (req, res) => {
  const result = await fairEvalService.listMyEvaluations({
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Mis evaluaciones obtenidas correctamente');
});

// ── Declaración de jurado (JURY) ────────────────────────────────────

// POST /api/fairs/:id/jury/declaration
export const createMyDeclaration = asyncHandler(async (req, res) => {
  const declaration = await fairEvalService.createMyDeclaration({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, declaration, 'Declaración de jurado registrada correctamente');
});

// GET /api/fairs/:id/jury/declaration
export const getMyDeclaration = asyncHandler(async (req, res) => {
  const declaration = await fairEvalService.getMyDeclaration({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, declaration, 'Declaración de jurado obtenida correctamente', {}, HTTP_STATUS.OK);
});

// ── Mi avance (JURY) ────────────────────────────────────────────────

// GET /api/fairs/my-progress/:fairId
export const getMyProgress = asyncHandler(async (req, res) => {
  const progress = await fairEvalService.getMyProgress({
    fairId: req.params.fairId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, progress, 'Avance obtenido correctamente', {}, HTTP_STATUS.OK);
});

export default {
  createRubric,
  getRubric,
  updateRubric,
  addCriterion,
  updateCriterion,
  removeCriterion,
  listApprovedProjects,
  getProjectDetail,
  listEvaluations,
  createEvaluation,
  updateEvaluation,
  listMyEvaluations,
  createMyDeclaration,
  getMyDeclaration,
  getMyProgress,
};