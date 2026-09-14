// src/modules/projects/project.controller.js
import * as projectService from './project.service.js';
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

// GET /api/projects
export const listProjects = asyncHandler(async (req, res) => {
  const result = await projectService.listProjects({
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Proyectos obtenidos correctamente');
});

// GET /api/projects/:id
export const getProjectById = asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById({
    projectId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, project, 'Proyecto obtenido correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/projects
export const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject({
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, project, 'Proyecto creado correctamente');
});

// PUT /api/projects/:id
export const updateProject = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject({
    projectId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, project, 'Proyecto actualizado correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/projects/:id/submit
export const submitProject = asyncHandler(async (req, res) => {
  const project = await projectService.submitProject({
    projectId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, project, 'Proyecto enviado a revisión correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/projects/:id/review
export const reviewProject = asyncHandler(async (req, res) => {
  const project = await projectService.reviewProject({
    projectId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, project, 'Revisión registrada correctamente', {}, HTTP_STATUS.OK);
});

// GET /api/projects/:id/members
export const listMembers = asyncHandler(async (req, res) => {
  const result = await projectService.listMembers({
    projectId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Integrantes obtenidos correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/projects/:id/members
export const addMember = asyncHandler(async (req, res) => {
  const member = await projectService.addMember({
    projectId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, member, 'Integrante agregado correctamente');
});

// DELETE /api/projects/:id/members/:userId
export const removeMember = asyncHandler(async (req, res) => {
  const result = await projectService.removeMember({
    projectId: req.params.id,
    userId: req.params.userId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Integrante removido correctamente', {}, HTTP_STATUS.OK);
});

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