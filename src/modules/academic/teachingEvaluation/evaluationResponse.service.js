// src/modules/academic/teachingEvaluation/evaluationResponse.service.js
// Servicio de evaluaciones docentes.
// Workflow: DRAFT → SUBMITTED
// Una evaluación por estudiante y teaching_assignment.

import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { ROLES } from '../../../constants/roles.js';
import { getActiveCriteria } from './evaluationCriteria.service.js';

// ============================================================
// CONSTANTES
// ============================================================

export const MINIMUM_RESPONSES = 3;

// ============================================================
// HELPERS CENTRALIZADOS — MÍNIMO DE RESPUESTAS
// ============================================================

/**
 * Verifica si el conteo alcanza el mínimo requerido.
 * @param {number} count - Número de respuestas SUBMITTED
 * @returns {{ hasMinimum: boolean, count: number }}
 */
export const checkMinimumResponses = (count) => ({
  hasMinimum: count >= MINIMUM_RESPONSES,
  count,
});

/**
 * Envuelve el resultado aplicando la regla de mínimo.
 * Si no hay suficientes respuestas, retorna meta.insufficient_data = true.
 */
export const enforceMinimumResponses = (data, count) => {
  const validation = checkMinimumResponses(count);

  if (!validation.hasMinimum) {
    return {
      data: null,
      meta: {
        total_responses: count,
        minimum_required: MINIMUM_RESPONSES,
        insufficient_data: true,
      },
    };
  }

  return {
    data,
    meta: {
      total_responses: count,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};

// ============================================================
// VALIDACIONES PRIVADAS
// ============================================================

/**
 * Valida que el actor sea STUDENT y esté autorizado para evaluar.
 * Retorna teaching_assignment verificado.
 */
const validateStudentAndAssignment = async (teachingAssignmentId, actor) => {
  // 1. Verificar rol
  if (actor.role !== ROLES.STUDENT) {
    throw ApiError.forbidden('Solo estudiantes pueden crear evaluaciones');
  }

  // 2. Verificar teaching_assignment
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id: teachingAssignmentId },
  });

  if (!assignment) {
    throw ApiError.notFound('Asignación docente no encontrada');
  }

  if (!assignment.isActive) {
    throw ApiError.badRequest('La asignación docente no está activa');
  }

  // 3. Verificar que el actor tenga student data
  const student = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      organizationId: true,
      careerId: true,
      currentCycle: true,
      admissionPeriodId: true,
    },
  });

  if (!student || student.role !== ROLES.STUDENT) {
    throw ApiError.forbidden('Usuario no es estudiante');
  }

  // 4. Verificar misma organización
  if (student.organizationId !== assignment.organizationId) {
    throw ApiError.forbidden('La asignación no pertenece a tu organización');
  }

  // 5. Verificar misma carrera
  if (student.careerId !== assignment.careerId) {
    throw ApiError.forbidden('La asignación no pertenece a tu carrera');
  }

  // 6. Verificar mismo ciclo
  if (student.currentCycle !== assignment.cycle) {
    throw ApiError.forbidden('El ciclo no coincide con tu ciclo actual');
  }

  // 7. Verificar mismo periodo
  if (student.admissionPeriodId !== assignment.academicPeriodId) {
    throw ApiError.forbidden('El periodo no coincide con tu periodo de admisión');
  }

  // 8. Verificar que no se evalúe a sí mismo
  if (assignment.teacherId === actor.id) {
    throw ApiError.badRequest('No puedes evaluarte a ti mismo');
  }

  return assignment;
};

/**
 * Verifica ownership de una evaluación.
 */
const assertOwnership = (response, actor) => {
  if (response.studentId !== actor.id) {
    throw ApiError.forbidden('No tienes acceso a esta evaluación');
  }
};

/**
 * Verifica que la evaluación esté en DRAFT.
 */
const assertDraft = (response) => {
  if (response.status !== 'DRAFT') {
    throw ApiError.conflict('Solo se pueden modificar evaluaciones en estado DRAFT');
  }
};

// ============================================================
// CRUD DE EVALUACIONES
// ============================================================

/**
 * Crea un nuevo DRAFT de evaluación.
 * Sin detalles iniciales.
 */
export const createDraft = async (teachingAssignmentId, actor) => {
  const assignment = await validateStudentAndAssignment(teachingAssignmentId, actor);

  // Verificar que no exista ya una evaluación para esta asignación
  const existing = await prisma.evaluationResponse.findUnique({
    where: {
      teachingAssignmentId_studentId: {
        teachingAssignmentId,
        studentId: actor.id,
      },
    },
  });

  if (existing) {
    throw ApiError.conflict('Ya tienes una evaluación para esta asignación');
  }

  return prisma.evaluationResponse.create({
    data: {
      teachingAssignmentId,
      studentId: actor.id,
      status: 'DRAFT',
      submittedAt: null,
    },
  });
};

/**
 * Obtiene una evaluación por ID (solo el propietario).
 */
export const getResponse = async (responseId, actor) => {
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
    include: {
      teachingAssignment: {
        include: {
          course: true,
          teacher: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      details: {
        include: {
          criterion: {
            select: { id: true, name: true, isActive: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  assertOwnership(response, actor);

  return response;
};

/**
 * Lista las evaluaciones del estudiante autenticado.
 */
export const listMyResponses = async (actor) => {
  if (actor.role !== ROLES.STUDENT) {
    throw ApiError.forbidden('Solo estudiantes pueden ver sus evaluaciones');
  }

  return prisma.evaluationResponse.findMany({
    where: { studentId: actor.id },
    include: {
      teachingAssignment: {
        include: {
          course: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      details: {
        select: { id: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
};

/**
 * Actualiza el comentario de una evaluación DRAFT.
 */
export const updateComment = async (responseId, { comment }, actor) => {
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  assertOwnership(response, actor);
  assertDraft(response);

  return prisma.evaluationResponse.update({
    where: { id: responseId },
    data: { comment: comment || null },
  });
};

/**
 * Elimina una evaluación DRAFT (y sus detalles en cascade).
 */
export const deleteDraft = async (responseId, actor) => {
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  assertOwnership(response, actor);
  assertDraft(response);

  await prisma.evaluationResponse.delete({
    where: { id: responseId },
  });

  return { deleted: true };
};

/**
 * Envía una evaluación (DRAFT → SUBMITTED).
 *
 * REGLA CRÍTICA: Los criterios obligatorios se determinan
 * EXACTAMENTE al momento del SUBMIT.
 *
 * - Criterios activos al momento del SUBMIT → obligatorios
 * - Criterios desactivados antes del SUBMIT → NO obligatorios
 * - Criterios creados después del DRAFT pero activos al SUBMIT → SÍ obligatorios
 */
export const submitResponse = async (responseId, actor) => {
  const response = await prisma.evaluationResponse.findUnique({
    where: { id: responseId },
    include: {
      details: {
        select: { criterionId: true },
      },
      teachingAssignment: {
        select: { organizationId: true },
      },
    },
  });

  if (!response) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  assertOwnership(response, actor);
  assertDraft(response);

  // 1. Debe tener al menos un detalle
  if (response.details.length === 0) {
    throw ApiError.badRequest('La evaluación debe tener al menos un criterio evaluado');
  }

  // 2. Obtener criterios activos EXACTAMENTE AHORA
  const activeCriteria = await getActiveCriteria(response.teachingAssignment.organizationId);

  // 3. Verificar que TODOS los criterios activos estén respondidos
  const respondedCriterionIds = new Set(response.details.map((d) => d.criterionId));
  const missingCriteria = activeCriteria.filter((c) => !respondedCriterionIds.has(c.id));

  if (missingCriteria.length > 0) {
    throw ApiError.badRequest(
      `Faltan criterios obligatorios: ${missingCriteria.map((c) => c.name).join(', ')}`
    );
  }

  // 4. Enviar
  return prisma.evaluationResponse.update({
    where: { id: responseId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
};
