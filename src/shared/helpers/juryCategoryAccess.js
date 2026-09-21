// src/shared/helpers/juryCategoryAccess.js
// Helper central de autorización JURY → CATEGORY → PROJECT.
//
// Centraliza la comprobación de que un JURY:
//   1. Tiene rol JURY.
//   2. Está ACTIVE.
//   3. Está asignado a la FAIR (fair_jury_assignments).
//   4. La feria está en OPEN.
//   5. Tiene al menos una categoría asignada en esa feria.
//   6. El proyecto pertenece a una de sus categorías asignadas.
//
// NO debe duplicarse independientemente en cada endpoint.

import { prisma } from '../../database/prisma.js';
import { ApiError } from '../errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

/**
 * Verifica que un JURY pueda operar sobre un proyecto específico.
 * Lanza ApiError si alguna condición no se cumple.
 *
 * @param {Object} params
 * @param {string} params.fairId - ID de la feria
 * @param {string} params.projectId - ID del proyecto
 * @param {Object} params.actor - Usuario autenticado (req.user decodificado)
 * @returns {Object} La asignación de jurado a la feria
 */
export const assertJuryCanOperateOnProject = async ({ fairId, projectId, actor }) => {
  // 1. Rol JURY
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo los usuarios con rol JURY pueden realizar esta acción');
  }

  // 2. ACTIVE
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, status: true, role: true, organizationId: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.forbidden('El usuario no está activo');
  }

  // 3. Asignado a la FAIR
  const assignment = await prisma.fairJuryAssignment.findFirst({
    where: { fairId, userId: actor.id },
    select: { id: true, fairId: true, userId: true },
  });
  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  }

  // 4. Feria OPEN
  const fair = await prisma.fair.findUnique({
    where: { id: fairId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  if (fair.status !== 'OPEN') {
    throw ApiError.conflict('Solo puedes operar proyectos mientras la feria está abierta (OPEN)');
  }

  // 5. Organización coincide
  if (fair.organizationId !== user.organizationId) {
    throw ApiError.forbidden('No tienes acceso a esta feria');
  }

  // 6. Proyecto existe, pertenece a la feria, y es APPROVED
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, fairId: true, status: true, categoryId: true },
  });
  if (!project) throw ApiError.notFound('Proyecto no encontrado');
  if (String(project.fairId) !== String(fairId)) {
    throw ApiError.notFound('El proyecto no pertenece a esta feria');
  }
  if (project.status !== 'APPROVED') {
    throw ApiError.notFound('El proyecto no está aprobado para evaluación');
  }

  // 7. Proyecto tiene categoría
  if (!project.categoryId) {
    throw ApiError.conflict('El proyecto no tiene categoría asignada');
  }

  // 8. El JURY tiene al menos una categoría asignada
  const juryCategories = await prisma.fairJuryCategoryAssignment.findMany({
    where: { juryAssignmentId: assignment.id },
    select: { categoryId: true },
  });
  if (juryCategories.length === 0) {
    throw ApiError.forbidden('No tienes categorías asignadas en esta feria');
  }

  // 9. El proyecto pertenece a una de las categorías del JURY
  const juryCategoryIds = juryCategories.map((jc) => jc.categoryId);
  if (!juryCategoryIds.includes(project.categoryId)) {
    throw ApiError.forbidden('No tienes acceso a este proyecto por tu asignación de categorías');
  }

  return assignment;
};

/**
 * Obtiene los IDs de categorías asignadas a un JURY en una feria.
 * Útil para filtrar listados de proyectos.
 *
 * @param {string} fairId
 * @param {string} userId
 * @returns {Promise<string[]>} Array de category IDs
 */
export const getJuryCategoryIds = async (fairId, userId) => {
  const assignment = await prisma.fairJuryAssignment.findFirst({
    where: { fairId, userId },
    select: { id: true },
  });
  if (!assignment) return [];

  const categories = await prisma.fairJuryCategoryAssignment.findMany({
    where: { juryAssignmentId: assignment.id },
    select: { categoryId: true },
  });
  return categories.map((c) => c.categoryId);
};

/**
 * Verifica que un JURY tenga al menos una categoría asignada en una feria.
 * Lanza ApiError si no tiene categorías.
 *
 * @param {string} fairId
 * @param {string} userId
 */
export const assertJuryHasCategories = async (fairId, userId) => {
  const assignment = await prisma.fairJuryAssignment.findFirst({
    where: { fairId, userId },
    select: { id: true },
  });
  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  }

  const count = await prisma.fairJuryCategoryAssignment.count({
    where: { juryAssignmentId: assignment.id },
  });
  if (count === 0) {
    throw ApiError.forbidden('No tienes categorías asignadas en esta feria');
  }
};
