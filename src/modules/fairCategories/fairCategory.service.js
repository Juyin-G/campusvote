// src/modules/fairCategories/fairCategory.service.js
// Lógica de negocio de CATEGORÍAS de ferias (dominio exclusivo de FERIAS).
//
// Estructura:
//   Fair ── FairCategory (fair_id + name) ── Project (projects.category_id)
//
// Reglas:
//   - Las categorías son ESTADÍSTICAS de la feria: NO existe catálogo global.
//     No se reutiliza el catálogo OCDE/CONCYTEC de candidate_lists (dominio
//     electoral) — organizations.category_catalog es un JSONB ajeno a ferias.
//   - Gestión (crear/actualizar/eliminar) SOLO en DRAFT; lectura compartida
//     (ADMIN con organización dueña o JURY formalmente asignado) en cualquier
//     estado.
//   - SUPERADMIN NO tiene acceso operativo: 403 desde el router (sin bypass
//     aunque tenga organizationId).
//   - UNIQUE (fair_id, name): sin duplicados dentro de la misma feria.
//   - No se elimina una categoría que ya tiene proyectos asignados → 409.

import * as categoryRepository from './fairCategory.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const CATEGORY_CONFIGURABLE_STATUSES = ['DRAFT'];

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
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
  const assignment = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  }
  return assignment;
};

const assertCategoryConfigurable = (fair) => {
  if (!CATEGORY_CONFIGURABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('Las categorías de la feria solo se configuran en estado DRAFT');
  }
};

const mapCategory = (category) => ({
  id: category.id,
  fair_id: category.fairId,
  name: category.name,
  description: category.description,
  created_at: category.createdAt,
  updated_at: category.updatedAt,
});

// ── Lectura compartida (ADMIN/JURY asignado) ───────────────────────

export const listCategories = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);

  if (actor.role === ROLES.JURY) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }

  const categories = await categoryRepository.findByFair(fairId);

  return {
    fair_id: fairId,
    fair_name: fair.name,
    count: categories.length,
    categories: categories.map(mapCategory),
  };
};

// ── Gestión (ADMIN; SOLO DRAFT) ───────────────────────────────────

export const createCategory = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertCategoryConfigurable(fair);

  try {
    const category = await categoryRepository.create({
      fairId,
      name: data.name,
      description: data.description ?? null,
    });
    return mapCategory(category);
  } catch (err) {
    if (err.message === 'FAIR_CATEGORY_DUPLICATE') {
      throw ApiError.conflict('Ya existe una categoría con ese nombre en esta feria');
    }
    throw err;
  }
};

export const updateCategory = async ({ fairId, categoryId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertCategoryConfigurable(fair);

  const current = await categoryRepository.findById(categoryId, fairId);
  if (!current) {
    throw ApiError.notFound('Categoría no encontrada en esta feria');
  }

  try {
    const updated = await categoryRepository.update(categoryId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
    });
    return mapCategory(updated);
  } catch (err) {
    if (err.message === 'FAIR_CATEGORY_DUPLICATE') {
      throw ApiError.conflict('Ya existe una categoría con ese nombre en esta feria');
    }
    throw err;
  }
};

export const deleteCategory = async ({ fairId, categoryId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertCategoryConfigurable(fair);

  const current = await categoryRepository.findById(categoryId, fairId);
  if (!current) {
    throw ApiError.notFound('Categoría no encontrada en esta feria');
  }

  const used = await categoryRepository.countProjects(categoryId);
  if (used > 0) {
    throw ApiError.conflict('No se puede eliminar la categoría porque tiene proyectos asignados');
  }

  // Verificar que no haya jurados asignados a esta categoría.
  const jurorsWithCategory = await prisma.fairJuryCategoryAssignment.count({
    where: { categoryId },
  });
  if (jurorsWithCategory > 0) {
    throw ApiError.conflict('No se puede eliminar la categoría porque tiene jurados asignados');
  }

  await categoryRepository.remove(categoryId);

  return { deleted: true, fair_id: fairId, category_id: categoryId };
};

export default {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};