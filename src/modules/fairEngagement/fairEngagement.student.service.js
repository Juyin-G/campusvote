// src/modules/fairEngagement/fairEngagement.student.service.js
// Vista de engagement para integrantes del proyecto (estudiantes).
// NO expone el autor de los comentarios (anonimato).

import * as engagementRepository from './fairEngagement.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { mapCommentForStudent } from './fairEngagement.helpers.js';

const assertProjectInFair = async (fairId, projectId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  const project = await projectRepository.findById(projectId);
  if (!project || project.fairId !== fairId) {
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  return { fair, project };
};

/**
 * Verifica que el actor sea integrante del proyecto.
 * ADMIN y JURY asignado también pueden ver (ADMIN para moderación, JURY
 * asignado para revisar el contexto).
 */
const assertCanViewEngagement = async ({ fairId, projectId, actor }) => {
  const { fair, project } = await assertProjectInFair(fairId, projectId);

  if (actor.role === ROLES.ADMIN) return { fair, project };

  if (actor.role === ROLES.JURY) {
    const a = await juryAssignmentRepository.findByFairUser(fairId, actor.id);
    if (!a) {
      throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
    }
    return { fair, project };
  }

  // Estudiantes: solo integrantes del proyecto.
  if (actor.role === ROLES.STUDENT || actor.role === ROLES.TEACHER) {
    const members = await projectRepository.listMembers(projectId);
    const isMember = (members || []).some(
      (m) => m.user && m.user.id === actor.id
    );
    if (!isMember) {
      throw ApiError.forbidden('Solo los integrantes del proyecto pueden ver su engagement');
    }
    return { fair, project };
  }

  throw ApiError.forbidden('No autorizado');
};

/**
 * GET /api/fairs/:fairId/projects/:projectId/engagement
 * Vista integrada: conteo de Me gusta + comentarios anónimos.
 * Para integrantes del proyecto (estudiantes/docentes del equipo).
 */
export const getProjectEngagement = async ({ fairId, projectId, actor }) => {
  await assertCanViewEngagement({ fairId, projectId, actor });

  const [count, rows] = await Promise.all([
    engagementRepository.countLikesByProject(projectId),
    engagementRepository.listComments(projectId),
  ]);

  return {
    fair_id: fairId,
    project_id: projectId,
    likes_count: count,
    comments: rows.map(mapCommentForStudent),
  };
};
