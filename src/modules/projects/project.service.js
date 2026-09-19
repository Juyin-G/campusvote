// src/modules/projects/project.service.js
// Orquestador del módulo de proyectos de feria.
// Re-exporta la API pública desde los sub-servicios (lifecycle + members).

export {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
} from './project.lifecycle.service.js';

export {
  listMembers,
  addMember,
  removeMember,
} from './project.members.service.js';

import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
} from './project.lifecycle.service.js';
import { listMembers, addMember, removeMember } from './project.members.service.js';

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
