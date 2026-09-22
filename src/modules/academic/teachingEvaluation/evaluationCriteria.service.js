// src/modules/academic/teachingEvaluation/evaluationCriteria.service.js
// CRUD de criterios de evaluación docente.
// Los criterios son globales por organización.

import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { ROLES } from '../../../constants/roles.js';

const isAdmin = (actor) => [ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role);

/**
 * Verifica que el actor tenga acceso a la organización del criterio.
 */
const assertOrganizationAccess = (actor, organizationId) => {
  if (actor.role !== ROLES.SUPERADMIN && actor.organizationId !== organizationId) {
    throw ApiError.forbidden('El recurso no pertenece a tu organización');
  }
};

/**
 * Crea un nuevo criterio de evaluación.
 * Solo ADMIN/SUPERADMIN.
 * UNIQUE(organization_id, name) se valida en DB.
 */
export const createCriterion = async ({ name, description }, actor) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo administradores pueden crear criterios');
  }

  if (!actor.organizationId) {
    throw ApiError.badRequest('No se pudo determinar la organización');
  }

  try {
    return await prisma.evaluationCriterion.create({
      data: {
        organizationId: actor.organizationId,
        name: name.trim(),
        description: description || null,
        isActive: true,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Ya existe un criterio con ese nombre en esta organización');
    }
    throw error;
  }
};

/**
 * Lista criterios de una organización.
 * ADMIN ven todos, otros roles solo activos.
 */
export const listCriteria = async (actor) => {
  if (!actor.organizationId) {
    throw ApiError.badRequest('No se pudo determinar la organización');
  }

  const where = {
    organizationId: actor.organizationId,
    // Solo ADMIN/SUPERADMIN ven inactivos
    ...(!isAdmin(actor) ? { isActive: true } : {}),
  };

  return prisma.evaluationCriterion.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    include: {
      _count: {
        select: { details: true },
      },
    },
  });
};

/**
 * Obtiene un criterio por ID.
 */
export const getCriterion = async (criterionId, actor) => {
  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
    include: {
      _count: {
        select: { details: true },
      },
    },
  });

  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }

  assertOrganizationAccess(actor, criterion.organizationId);

  return criterion;
};

/**
 * Actualiza nombre y/o descripción de un criterio.
 * Solo ADMIN/SUPERADMIN.
 */
export const updateCriterion = async (criterionId, { name, description }, actor) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo administradores pueden modificar criterios');
  }

  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
  });

  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }

  assertOrganizationAccess(actor, criterion.organizationId);

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description || null;

  try {
    return await prisma.evaluationCriterion.update({
      where: { id: criterionId },
      data,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Ya existe un criterio con ese nombre en esta organización');
    }
    throw error;
  }
};

/**
 * Activa/desactiva un criterio.
 * Un criterio desactivado:
 * - NO puede recibir nuevos details
 * - Los details SUBMITTED existentes se conservan
 * - No es obligatorio para nuevos SUBMIT
 * Solo ADMIN/SUPERADMIN.
 */
export const toggleCriterion = async (criterionId, actor) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo administradores pueden activar/desactivar criterios');
  }

  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
  });

  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }

  assertOrganizationAccess(actor, criterion.organizationId);

  return prisma.evaluationCriterion.update({
    where: { id: criterionId },
    data: { isActive: !criterion.isActive },
  });
};

/**
 * Elimina un criterio.
 * Solo si NO tiene evaluation_response_details asociados.
 * ON DELETE RESTRICT en DB también lo impide.
 * Solo ADMIN/SUPERADMIN.
 */
export const deleteCriterion = async (criterionId, actor) => {
  if (!isAdmin(actor)) {
    throw ApiError.forbidden('Solo administradores pueden eliminar criterios');
  }

  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
    include: {
      _count: {
        select: { details: true },
      },
    },
  });

  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }

  assertOrganizationAccess(actor, criterion.organizationId);

  if (criterion._count.details > 0) {
    throw ApiError.conflict(
      'No se puede eliminar un criterio que ya tiene respuestas asociadas'
    );
  }

  await prisma.evaluationCriterion.delete({
    where: { id: criterionId },
  });

  return { deleted: true };
};

/**
 * Obtiene criterios activos de una organización.
 * Utilizado internamente para validación de SUBMIT.
 */
export const getActiveCriteria = async (organizationId) => {
  return prisma.evaluationCriterion.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }],
  });
};
