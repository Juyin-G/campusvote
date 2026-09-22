// src/modules/fairEvaluations/fairEvaluation.responses.service.js
// Hojas de respuesta (CHECKLIST) por JURY. DRAFT/OPEN. Finalización inmutable.

import * as evaluationRepository from './fairEvaluation.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import auditService from '../audit/audit.service.js';
import logger from '../../config/logger.js';
import { mapEvaluation, normalizeChecklistResponses } from './fairEvaluation.helpers.js';
import {
  loadFair,
  assertJuryAssignedToFair,
  assertRubricOpenForResponse,
  EVALUABLE_PROJECT_STATUS,
} from './fairEvaluation.access.js';
import { assertJuryCanOperateOnProject } from '../../shared/helpers/juryCategoryAccess.js';

const loadRubric = async (fairId) => {
  const rubric = await evaluationRepository.findRubricByFair(fairId);
  if (!rubric) throw ApiError.notFound('La feria aún no tiene una rúbrica configurada');
  return rubric;
};

/**
 * Crea/actualiza la hoja de respuestas del JURY para un proyecto.
 * Si finalize=true, marca submitted_at (inmutable después).
 */
export const upsertChecklist = async ({ fairId, projectId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertRubricOpenForResponse(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  // Verificar que el JURY puede operar sobre este proyecto (categoría).
  await assertJuryCanOperateOnProject({ fairId, projectId, actor });

  const rubric = await loadRubric(fairId);
  if (!rubric.criteria || rubric.criteria.length === 0) {
    throw ApiError.conflict('La rúbrica de la feria aún no tiene criterios configurados');
  }

  const project = await projectRepository.findById(projectId);
  if (!project) throw ApiError.notFound('Proyecto no encontrado');
  if (project.fairId !== fairId) {
    throw ApiError.badRequest('El proyecto no pertenece a esta feria');
  }
  if (!EVALUABLE_PROJECT_STATUS.includes(project.status)) {
    throw ApiError.conflict('Solo se pueden responder proyectos aprobados (APPROVED)');
  }

  const existing = await evaluationRepository.findEvaluationByFairProjectJury(
    fairId,
    projectId,
    actor.id
  );
  if (existing?.submittedAt) {
    throw ApiError.conflict('La rúbrica ya fue finalizada y no puede modificarse');
  }

  let normalized;
  try {
    normalized = normalizeChecklistResponses({
      criteria: rubric.criteria,
      responses: data.responses,
    });
  } catch (e) {
    throw ApiError.badRequest(e.message, { code: e.code });
  }

  const set = await evaluationRepository.upsertEvaluation({
    fairId,
    projectId,
    juryUserId: actor.id,
    rubricId: rubric.id,
    responses: normalized,
  });

  if (data.finalize) {
    await evaluationRepository.finalizeEvaluation(set.id);
    try {
      await auditService.logAction({
        actorId: actor.id,
        action: 'RUBRIC_CHECKLIST_FINALIZED',
        metadata: { fair_id: fairId, project_id: projectId, rubric_id: rubric.id },
      });
    } catch (err) {
      logger.warn('No se pudo registrar finalización de rúbrica en auditoría', {
        error: err.message,
      });
    }
  }

  const full = await evaluationRepository.findEvaluation(set.id, fairId);
  return mapEvaluation(full);
};

/** GET de la hoja del JURY autenticado (o null si aún no respondió). */
export const getMyChecklist = async ({ fairId, projectId, actor }) => {
  const fair = await loadFair(fairId);
  assertRubricOpenForResponse(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  // Verificar que el JURY puede operar sobre este proyecto (categoría).
  await assertJuryCanOperateOnProject({ fairId, projectId, actor });

  const rubric = await loadRubric(fairId);
  const existing = await evaluationRepository.findEvaluationByFairProjectJury(
    fairId,
    projectId,
    actor.id
  );
  if (!existing) {
    return {
      fair_id: fairId,
      project_id: projectId,
      rubric,
      submitted: false,
      responses: rubric.criteria.map((c) => ({
        criterion_id: c.id,
        criterion_name: c.name,
        criterion_position: c.position,
        checked: false,
      })),
    };
  }
  const full = await evaluationRepository.findEvaluation(existing.id, fairId);
  return {
    fair_id: fairId,
    project_id: projectId,
    rubric,
    ...mapEvaluation(full),
  };
};

export default {
  upsertChecklist,
  getMyChecklist,
};
