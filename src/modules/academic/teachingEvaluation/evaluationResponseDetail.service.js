// src/modules/academic/teachingEvaluation/evaluationResponseDetail.service.js
// Servicio de detalles de evaluación (score por criterio).
// Solo permite operaciones en evaluaciones DRAFT.

import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

// ============================================================
// VALIDACIONES PRIVADAS
// ============================================================

/**
 * Valida que la evaluación exista, sea del actor y esté en DRAFT.
 */
const validateResponseForDetail = async (responseId, actor) => {
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
    include: {
      teachingAssignment: {
        select: { organizationId: true },
      },
    },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  if (response.studentId !== actor.id) {
    throw ApiError.forbidden('No tienes acceso a esta evaluación');
  }

  if (response.status !== 'DRAFT') {
    throw ApiError.conflict(
      'Solo se pueden modificar detalles en evaluaciones en estado DRAFT'
    );
  }

  return response;
};

/**
 * Valida que el criterio exista, esté activo y pertenezca a la organización.
 */
const validateCriterion = async (criterionId, organizationId) => {
  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
  });

  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }

  if (!criterion.isActive) {
    throw ApiError.badRequest(
      'El criterio está inactivo y no puede recibir nuevas evaluaciones'
    );
  }

  if (criterion.organizationId !== organizationId) {
    throw ApiError.forbidden('El criterio no pertenece a esta organización');
  }

  return criterion;
};

// ============================================================
// CRUD DE DETALLES
// ============================================================

/**
 * Crea o actualiza un detalle (score por criterio).
 * Si ya existe un detail para ese criterion, actualiza el score.
 * Si no existe, lo crea.
 *
 * REGLA: Un criterio desactivado NO puede recibir nuevos details.
 */
export const upsertDetail = async (responseId, criterionId, score, actor) => {
  // 1. Validar evaluación
  const response = await validateResponseForDetail(responseId, actor);

  // 2. Validar criterio (activo y misma organización)
  await validateCriterion(criterionId, response.teachingAssignment.organizationId);

  // 3. Validar score
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw ApiError.badRequest('El score debe ser un número entero entre 1 y 5');
  }

  // 4. Upsert (create o update)
  try {
    return await prisma.evaluationResponseDetail.upsert({
      where: {
        uq_eval_response_details_response_criterion: {
          evaluationResponseId: responseId,
          criterionId,
        },
      },
      update: { score },
      create: {
        evaluationResponseId: responseId,
        criterionId,
        score,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Ya existe un detalle para este criterio en esta evaluación');
    }
    throw error;
  }
};

/**
 * Elimina un detalle específico.
 */
export const deleteDetail = async (responseId, criterionId, actor) => {
  // 1. Validar evaluación
  await validateResponseForDetail(responseId, actor);

  // 2. Buscar detalle existente
  const detail = await prisma.evaluationResponseDetail.findUnique({
    where: {
      uq_eval_response_details_response_criterion: {
        evaluationResponseId: responseId,
        criterionId,
      },
    },
  });

  if (!detail) {
    throw ApiError.notFound('Detalle no encontrado');
  }

  // 3. Eliminar
  await prisma.evaluationResponseDetail.delete({
    where: {
      uq_eval_response_details_response_criterion: {
        evaluationResponseId: responseId,
        criterionId,
      },
    },
  });

  return { deleted: true };
};

/**
 * Lista los detalles de una evaluación.
 */
export const getDetails = async (responseId, actor) => {
  // Validar acceso a la evaluación
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  if (response.studentId !== actor.id) {
    throw ApiError.forbidden('No tienes acceso a esta evaluación');
  }

  return prisma.evaluationResponseDetail.findMany({
    where: { evaluationResponseId: responseId },
    include: {
      criterion: {
        select: { id: true, name: true, isActive: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });
};
