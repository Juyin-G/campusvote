// src/modules/fairResults/fairResult.repository.js
// Consultas de resultados (dominio FERIAS). NO re-calcula nada: devuelve los
// datos crudos (proyectos APPROVED de la feria + total_score de sus
// evaluaciones) para que el SERVICE derive promedio, ranking y ganador.
//
// La agregación se hace en el service para mantener la lógica de negocio
// (reglas de desempate, precision de 2 decimales) testable sin BD.

import { prisma } from '../../database/prisma.js';

const APPROVED = 'APPROVED';

/** Proyectos APPROVED de la feria (única fuente de verdad del tenant: FAIR). */
export const listApprovedProjects = (fairId) =>
  prisma.project.findMany({
    where: { fairId, status: APPROVED },
    select: {
      id: true,
      fairId: true,
      name: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

/** total_score de todas las evaluaciones de la feria (una por proyecto/jurado). */
export const listEvaluationTotals = (fairId) =>
  prisma.fairEvaluation.findMany({
    where: { fairId },
    select: {
      projectId: true,
      totalScore: true,
    },
  });

// ════════════════════════════════════════════════════════════════════
// PUBLICACIÓN DE RESULTADOS (persistencia mínima; ranking sigue DERIVADO)
// ════════════════════════════════════════════════════════════════════

const PUBLICATION_SELECT = {
  id: true,
  fairId: true,
  publishedById: true,
  createdAt: true,
  updatedAt: true,
  publishedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

/** Publicación de una feria (null si aún no se publicó). Máximo una por fair. */
export const findPublicationByFair = (fairId) =>
  prisma.fairResultPublication.findUnique({
    where: { fairId },
    select: PUBLICATION_SELECT,
  });

/** Crea la publicación (el UNIQUE fair_id la limita a una por feria). */
export const createPublication = async ({ fairId, publishedById }) => {
  try {
    return await prisma.fairResultPublication.create({
      data: { fairId, publishedById },
      select: PUBLICATION_SELECT,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new Error('FAIR_RESULT_ALREADY_PUBLISHED');
    }
    throw error;
  }
};

export default {
  listApprovedProjects,
  listEvaluationTotals,
  findPublicationByFair,
  createPublication,
};