// src/modules/fairEvaluations/fairEvaluation.rubric.service.js
// CRUD de la rúbrica CHECKLIST (ADMIN). Solo DRAFT.

import * as evaluationRepository from './fairEvaluation.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { mapRubric } from './fairEvaluation.helpers.js';
import { assertTenantMatch, assertRubricConfigurable, loadFair } from './fairEvaluation.access.js';

const loadRubric = async (fairId) => {
  const rubric = await evaluationRepository.findRubricByFair(fairId);
  if (!rubric) throw ApiError.notFound('La feria aún no tiene una rúbrica configurada');
  return rubric;
};

export const createRubric = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);
  const existing = await evaluationRepository.findRubricByFair(fairId);
  if (existing) throw ApiError.conflict('La feria ya tiene una rúbrica configurada');
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
  await evaluationRepository.updateRubric(fairId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
  });
  return mapRubric({ ...current, criteria: current.criteria });
};

export const getRubric = async (fairId) => {
  const rubric = await loadRubric(fairId);
  return mapRubric(rubric);
};

export const addCriterion = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);
  const rubric = await loadRubric(fairId);
  const position = data.position ?? (await evaluationRepository.nextCriterionPosition(rubric.id));
  try {
    const c = await evaluationRepository.createCriterion({
      rubricId: rubric.id,
      name: data.name,
      description: data.description ?? null,
      position,
      isActive: true,
    });
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      position: c.position,
      is_active: c.isActive,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    };
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
  if (!current) throw ApiError.notFound('Criterio no encontrado en la rúbrica de esta feria');
  try {
    const updated = await evaluationRepository.updateCriterion(criterionId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      ...(data.is_active !== undefined ? { isActive: Boolean(data.is_active) } : {}),
    });
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      position: updated.position,
      is_active: updated.isActive,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  } catch (err) {
    if (err?.code === 'P2002') throw ApiError.conflict('Ya existe un criterio en esa posición');
    throw err;
  }
};

export const removeCriterion = async ({ fairId, criterionId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertRubricConfigurable(fair);
  const rubric = await loadRubric(fairId);
  const current = await evaluationRepository.findCriterion(criterionId, rubric.id);
  if (!current) throw ApiError.notFound('Criterio no encontrado en la rúbrica de esta feria');
  await evaluationRepository.deleteCriterion(criterionId);
  return { deleted: true, fair_id: fairId, criterion_id: criterionId };
};

export default {
  createRubric,
  updateRubric,
  getRubric,
  addCriterion,
  updateCriterion,
  removeCriterion,
};
