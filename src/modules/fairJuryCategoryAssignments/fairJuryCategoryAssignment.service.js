// src/modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.service.js
// Asignación de JURADOS a CATEGORÍAS dentro de una FERIA (N:M).
//
// Estructura:
//   FairJuryAssignment (fair + jury)
//       └── FairJuryCategoryAssignment (jury_assignment + category)
//               └── FairCategory (fair + category)
//
// Autorización:
//   - ADMIN gestiona asignaciones de ferias de su organización.
//   - SUPERADMIN NO tiene acceso operativo (403 desde el router).
//   - Las asignaciones solo se modifican en DRAFT; en OPEN quedan congeladas.
//   - La categoría debe pertenecer a la misma feria que la asignación del jurado.

import * as categoryAssignmentRepository from './fairJuryCategoryAssignment.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import * as categoryRepository from '../fairCategories/fairCategory.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const CATEGORY_ASSIGNABLE_STATUSES = ['DRAFT'];

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

const assertFairConfigurable = (fair) => {
  if (!CATEGORY_ASSIGNABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('Las asignaciones de categoría solo se modifican en estado DRAFT');
  }
};

const mapAssignment = (a) => ({
  id: a.id,
  jury_assignment_id: a.juryAssignmentId,
  category_id: a.categoryId,
  category: a.category
    ? { id: a.category.id, name: a.category.name, description: a.category.description }
    : null,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

// ── Listar categorías asignadas a un JURY en una FAIR ─────────────

export const listByUser = async ({ fairId, userId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const assignment = await juryAssignmentRepository.findByFairUser(fairId, userId);
  if (!assignment) {
    throw ApiError.notFound('El usuario no está asignado como jurado de esta feria');
  }

  const categories = await categoryAssignmentRepository.listByJuryAssignment(assignment.id);

  return {
    fair_id: fairId,
    user_id: userId,
    count: categories.length,
    categories: categories.map(mapAssignment),
  };
};

// ── Asignar categoría a un JURY ──────────────────────────────────

export const assignCategory = async ({ fairId, userId, categoryId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertFairConfigurable(fair);

  const assignment = await juryAssignmentRepository.findByFairUser(fairId, userId);
  if (!assignment) {
    throw ApiError.notFound('El usuario no está asignado como jurado de esta feria');
  }

  const category = await categoryRepository.findById(categoryId, fairId);
  if (!category) {
    throw ApiError.notFound('La categoría no pertenece a esta feria');
  }

  const existing = await categoryAssignmentRepository.findByJuryAssignmentAndCategory(
    assignment.id,
    categoryId
  );
  if (existing) {
    throw ApiError.conflict('El jurado ya está asignado a esta categoría');
  }

  try {
    const result = await categoryAssignmentRepository.create({
      juryAssignmentId: assignment.id,
      categoryId,
    });
    return mapAssignment(result);
  } catch (err) {
    if (err.message === 'FAIR_JURY_CATEGORY_DUPLICATE') {
      throw ApiError.conflict('El jurado ya está asignado a esta categoría');
    }
    if (err.message === 'FAIR_JURY_CATEGORY_FOREIGN_KEY') {
      throw ApiError.badRequest('La asignación de jurado o la categoría no son válidas');
    }
    throw err;
  }
};

// ── Quitar categoría a un JURY ───────────────────────────────────

export const removeCategory = async ({ fairId, userId, categoryId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertFairConfigurable(fair);

  const assignment = await juryAssignmentRepository.findByFairUser(fairId, userId);
  if (!assignment) {
    throw ApiError.notFound('El usuario no está asignado como jurado de esta feria');
  }

  const existing = await categoryAssignmentRepository.findByJuryAssignmentAndCategory(
    assignment.id,
    categoryId
  );
  if (!existing) {
    throw ApiError.notFound('El jurado no está asignado a esta categoría');
  }

  await categoryAssignmentRepository.remove(assignment.id, categoryId);

  return { deleted: true, fair_id: fairId, user_id: userId, category_id: categoryId };
};

export default {
  listByUser,
  assignCategory,
  removeCategory,
};
